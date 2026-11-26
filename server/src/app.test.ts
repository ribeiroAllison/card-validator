import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { createCardSource } from "./cards.js";
import type { LlmClient } from "./ai.js";
import { computeScore, normalizeCriteria } from "./scoring.js";
import { htmlToText } from "./html.js";
import type { Rubric } from "./types.js";

const rubric: Rubric = {
  version: "t",
  scale: "",
  criteria: [
    { id: "a", name: "A", weight: 2, description: "", levels: { "0": "", "1": "", "2": "" } },
    { id: "b", name: "B", weight: 1, description: "", levels: { "0": "", "1": "", "2": "" } },
  ],
};

test("normaliza notas e calcula média ponderada", () => {
  const c = normalizeCriteria(rubric, [
    { id: "a", score: 2, justification: "ok" },
    { id: "b", score: 7, justification: "fora da escala" },
    { id: "zzz", score: 2 },
  ]);
  assert.deepEqual(c.map((x) => x.score), [2, 2]);
  assert.equal(computeScore(c), 100);

  const missing = normalizeCriteria(rubric, [{ id: "a", score: 1 }]);
  assert.equal(missing[1].score, 0);
  assert.equal(computeScore(missing), 33); // (1*2 + 0*1) / 6
});

test("htmlToText converte listas e entidades", () => {
  assert.equal(htmlToText("<p>Ol&aacute; &amp; tchau</p><ul><li>um</li><li>dois</li></ul>"), "Ol&aacute; & tchau\n\n- um\n- dois");
  assert.equal(htmlToText("a&#233;b&nbsp;c"), "aéb c");
});

// IA falsa: devolve respostas fixas conforme a ferramenta pedida
const fakeLlm: LlmClient = {
  async callTool({ tool, user }) {
    if (tool.name === "registrar_avaliacao") {
      const good = user.includes("Recuperação de senha");
      const s = good ? 2 : 0;
      return {
        criteria: ["objetivo", "criterios_aceite", "regras_negocio", "casos_erro", "dados_limites", "dependencias"].map(
          (id) => ({ id, score: s, justification: "teste" }),
        ),
        questions: good ? [] : ["Quais campos devem ser validados?"],
        summary: good ? "Pronto." : "Faltam informações.",
      };
    }
    return {
      funcionalidade: "Recuperação de senha",
      cenarios: [
        { titulo: "Link enviado", tipo: "feliz", gherkin: "Cenário: Link enviado\n  Dado que...\n  Então..." },
        { titulo: "Sem tipo", tipo: "xpto", gherkin: "Cenário: X\n  Dado..." },
      ],
      lacunas: [],
    };
  },
};

test("fluxo da API em modo demo", async () => {
  delete process.env.AZDO_PAT;
  const server = createApp(createCardSource(), fakeLlm).listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  const post = (p: string, body: unknown) =>
    fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    const health = await (await fetch(base + "/health")).json();
    assert.equal(health.mode, "demo");

    const list = await (await fetch(base + "/cards")).json();
    assert.ok(list.length >= 3);

    const good = await (await post("/cards/101/evaluate", {})).json();
    assert.equal(good.score, 100);
    assert.equal(good.passed, true);

    const bad = await (await post("/cards/103/evaluate", {})).json();
    assert.equal(bad.passed, false);
    const blocked = await post("/cards/103/scenarios", { evaluation: bad });
    assert.equal(blocked.status, 409);
    const forced = await post("/cards/103/scenarios", { evaluation: bad, force: true });
    assert.equal(forced.status, 200);

    const scen = await (await post("/cards/101/scenarios", { evaluation: good })).json();
    assert.equal(scen.scenarios.length, 2);
    assert.equal(scen.scenarios[1].type, "alternativo");

    const feature = await (await post("/cards/101/feature", { scenarios: scen })).text();
    assert.match(feature, /^# language: pt/);
    assert.match(feature, /Funcionalidade: Recuperação de senha/);

    const pub = await (await post("/cards/101/publish", { evaluation: good, scenarios: scen })).json();
    assert.equal(pub.published, false);
    assert.match(pub.html, /100\/100/);

    assert.equal((await fetch(base + "/cards/999")).status, 404);
    assert.equal((await post("/feedback", { cardId: 101, verdict: "nope" })).status, 400);
  } finally {
    server.close();
  }
});
