import { escapeHtml } from "./html.js";
import type { Evaluation, ScenarioSet } from "./types.js";

const ICON: Record<number, string> = { 0: "🔴", 1: "🟡", 2: "🟢" };

/** HTML do comentário publicado no card do Azure DevOps. */
export function buildComment(evaluation?: Evaluation, scenarios?: ScenarioSet): string {
  const parts: string[] = [];
  parts.push(`<p><b>🤖 Card Validator</b> <i>(gerado por IA — revisar)</i></p>`);

  if (evaluation) {
    const status = evaluation.passed ? "✅ pronto para desenvolvimento" : "⚠️ precisa de refinamento";
    parts.push(
      `<h3>Qualidade do card: ${evaluation.score}/100 — ${status}</h3>`,
      `<p>${escapeHtml(evaluation.summary)}</p>`,
      "<ul>" +
        evaluation.criteria
          .map(
            (c) =>
              `<li>${ICON[c.score]} <b>${escapeHtml(c.name)}</b> (${c.score}/2): ${escapeHtml(c.justification)}</li>`,
          )
          .join("") +
        "</ul>",
    );
    if (evaluation.questions.length) {
      parts.push(
        "<p><b>Perguntas para o refinamento</b></p>",
        "<ol>" + evaluation.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("") + "</ol>",
      );
    }
  }

  if (scenarios && scenarios.scenarios.length) {
    parts.push(`<h3>Cenários de teste (${scenarios.scenarios.length})</h3>`);
    parts.push(
      `<pre><code># language: pt\nFuncionalidade: ${escapeHtml(scenarios.feature)}\n\n` +
        scenarios.scenarios.map((s) => escapeHtml(s.gherkin)).join("\n\n") +
        "</code></pre>",
    );
    if (scenarios.gaps.length) {
      parts.push(
        "<p><b>Cenários que ficaram de fora por falta de informação</b></p>",
        "<ul>" + scenarios.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("") + "</ul>",
      );
    }
  }

  const model = scenarios?.model ?? evaluation?.model;
  parts.push(`<p><small>Modelo: ${escapeHtml(model ?? "")}${evaluation ? ` · rubrica v${escapeHtml(evaluation.rubricVersion)}` : ""}</small></p>`);
  return parts.join("\n");
}
