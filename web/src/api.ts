export interface Health {
  mode: "azdo" | "demo";
  project: string | null;
  model: string;
  aiMock: boolean;
  minScore: number;
}

export interface CardSummary {
  id: number;
  title: string;
  type: string;
  state: string;
}

export interface Card extends CardSummary {
  description: string;
  acceptanceCriteria: string;
  url?: string;
}

export interface CriterionResult {
  id: string;
  name: string;
  weight: number;
  score: 0 | 1 | 2;
  justification: string;
}

export interface Evaluation {
  cardId: number;
  score: number;
  minScore: number;
  passed: boolean;
  criteria: CriterionResult[];
  questions: string[];
  summary: string;
  rubricVersion: string;
  model: string;
  createdAt: string;
}

export type ScenarioType = "feliz" | "alternativo" | "erro" | "limite";

export interface Scenario {
  title: string;
  type: ScenarioType;
  gherkin: string;
}

export interface ScenarioSet {
  cardId: number;
  feature: string;
  scenarios: Scenario[];
  gaps: string[];
  model: string;
  createdAt: string;
}

export type Verdict = "util" | "editado" | "descartado";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => call<Health>("/health"),
  cards: () => call<CardSummary[]>("/cards"),
  card: (id: number) => call<Card>(`/cards/${id}`),
  evaluate: (id: number) => call<Evaluation>(`/cards/${id}/evaluate`, {}),
  scenarios: (id: number, evaluation: Evaluation | null, force: boolean) =>
    call<ScenarioSet>(`/cards/${id}/scenarios`, { evaluation, force }),
  publish: (id: number, evaluation: Evaluation | null, scenarios: ScenarioSet | null) =>
    call<{ published: boolean; html: string }>(`/cards/${id}/publish`, { evaluation, scenarios }),
  feedback: (cardId: number, scenarioTitle: string, verdict: Verdict) =>
    call("/feedback", { cardId, scenarioTitle, verdict }),
  async downloadFeature(id: number, scenarios: ScenarioSet) {
    const res = await fetch(`/api/cards/${id}/feature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarios }),
    });
    if (!res.ok) throw new Error("Não foi possível gerar o arquivo .feature");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: `card-${id}.feature` });
    a.click();
    URL.revokeObjectURL(url);
  },
};

/** Texto legível a partir do HTML do Azure DevOps (sem executar nada). */
export function htmlToText(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("li").forEach((li) => li.prepend("• "));
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, div, li, h1, h2, h3, h4, tr").forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
