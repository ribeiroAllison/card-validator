// Lógica de IA sem dependências de Node: usada pelo servidor e pela versão estática (GitHub Pages).
import { htmlToText } from "./html.js";
import { computeScore, normalizeCriteria, type RawCriterion } from "./scoring.js";
import type { Card, Evaluation, Rubric, Scenario, ScenarioSet, ScenarioType } from "./types.js";

/** Contrato mínimo do cliente da IA (permite trocar por um fake nos testes). */
export interface LlmClient {
  /** Nome exibido do modelo */
  model: string;
  callTool(args: {
    system: string;
    user: string;
    tool: { name: string; description: string; input_schema: Record<string, unknown> };
    maxTokens: number;
  }): Promise<Record<string, unknown>>;
}

export function rubricToText(rubric: Rubric): string {
  return [
    rubric.scale,
    ...rubric.criteria.map(
      (c) =>
        `### ${c.id} — ${c.name} (peso ${c.weight})\n${c.description}\n` +
        `- 0: ${c.levels["0"]}\n- 1: ${c.levels["1"]}\n- 2: ${c.levels["2"]}`,
    ),
  ].join("\n\n");
}

export function cardToText(card: Card): string {
  return [
    `# Card #${card.id} (${card.type}, estado: ${card.state})`,
    `## Título\n${card.title}`,
    `## Descrição\n${htmlToText(card.description) || "(vazio)"}`,
    `## Critérios de aceite\n${htmlToText(card.acceptanceCriteria) || "(vazio)"}`,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Avaliação do card
// ---------------------------------------------------------------------------

export async function evaluateWith(
  llm: LlmClient,
  card: Card,
  rubric: Rubric,
  promptTemplate: string,
  minScore: number,
): Promise<Evaluation> {
  const system = promptTemplate.replace("{{RUBRIC}}", rubricToText(rubric));
  const input = await llm.callTool({
    system,
    user: cardToText(card),
    maxTokens: 3000,
    tool: {
      name: "registrar_avaliacao",
      description: "Registra a avaliação do card segundo a rubrica.",
      input_schema: {
        type: "object",
        properties: {
          criteria: {
            type: "array",
            description: "Um item por critério da rubrica.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", enum: rubric.criteria.map((c) => c.id) },
                score: { type: "integer", enum: [0, 1, 2] },
                justification: { type: "string" },
              },
              required: ["id", "score", "justification"],
            },
          },
          questions: { type: "array", items: { type: "string" }, maxItems: 8 },
          summary: { type: "string" },
        },
        required: ["criteria", "questions", "summary"],
      },
    },
  });

  const criteria = normalizeCriteria(rubric, input.criteria as RawCriterion[] | undefined);
  const score = computeScore(criteria);
  return {
    cardId: card.id,
    score,
    minScore,
    passed: score >= minScore,
    criteria,
    questions: asStrings(input.questions).slice(0, 8),
    summary: String(input.summary ?? ""),
    rubricVersion: rubric.version,
    model: llm.model,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Geração de cenários
// ---------------------------------------------------------------------------

const SCENARIO_TYPES: ScenarioType[] = ["feliz", "alternativo", "erro", "limite"];

export async function generateWith(
  llm: LlmClient,
  card: Card,
  promptTemplate: string,
  openQuestions: string[] = [],
): Promise<ScenarioSet> {
  const questions = openQuestions.length
    ? "Perguntas ainda em aberto sobre este card (não presuma respostas; se um cenário depende delas, registre como lacuna):\n" +
      openQuestions.map((q) => `- ${q}`).join("\n")
    : "";
  const system = promptTemplate.replace("{{QUESTIONS}}", questions);
  const input = await llm.callTool({
    system,
    user: cardToText(card),
    maxTokens: 8000,
    tool: {
      name: "registrar_cenarios",
      description: "Registra os cenários de teste em Gherkin gerados para o card.",
      input_schema: {
        type: "object",
        properties: {
          funcionalidade: { type: "string", description: "Nome da Funcionalidade (linha 'Funcionalidade:')." },
          cenarios: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" },
                tipo: { type: "string", enum: SCENARIO_TYPES },
                gherkin: { type: "string" },
              },
              required: ["titulo", "tipo", "gherkin"],
            },
          },
          lacunas: { type: "array", items: { type: "string" } },
        },
        required: ["funcionalidade", "cenarios", "lacunas"],
      },
    },
  });

  const scenarios: Scenario[] = (Array.isArray(input.cenarios) ? input.cenarios : [])
    .map((s: Record<string, unknown>) => ({
      title: String(s.titulo ?? "").trim(),
      type: (SCENARIO_TYPES.includes(s.tipo as ScenarioType) ? s.tipo : "alternativo") as ScenarioType,
      gherkin: String(s.gherkin ?? "").trim(),
    }))
    .filter((s) => s.gherkin);

  return {
    cardId: card.id,
    feature: String(input.funcionalidade ?? card.title),
    scenarios,
    gaps: asStrings(input.lacunas),
    model: llm.model,
    createdAt: new Date().toISOString(),
  };
}

/** Monta o arquivo .feature completo. */
export function toFeatureFile(set: ScenarioSet, cardId = set.cardId): string {
  const indent = (text: string) =>
    text
      .split("\n")
      .map((l) => (l.trim() ? "  " + l : ""))
      .join("\n");
  return [
    "# language: pt",
    `# Card #${cardId} — gerado por IA, revisar antes de usar`,
    `Funcionalidade: ${set.feature}`,
    "",
    set.scenarios.map((s) => indent(s.gherkin)).join("\n\n"),
    "",
  ].join("\n");
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}
