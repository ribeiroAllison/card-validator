import type { CriterionResult, Rubric } from "./types.js";

export interface RawCriterion {
  id?: unknown;
  score?: unknown;
  justification?: unknown;
}

/**
 * Normaliza a resposta da IA contra a rubrica: garante um resultado por critério,
 * na ordem da rubrica, com nota inteira entre 0 e 2. Critério ausente vale 0.
 */
export function normalizeCriteria(rubric: Rubric, raw: RawCriterion[] | undefined): CriterionResult[] {
  const byId = new Map((raw ?? []).map((r) => [String(r.id ?? ""), r]));
  return rubric.criteria.map((c) => {
    const r = byId.get(c.id);
    const n = Math.round(Number(r?.score));
    const score = (Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : 0) as 0 | 1 | 2;
    return {
      id: c.id,
      name: c.name,
      weight: c.weight,
      score,
      justification: r ? String(r.justification ?? "") : "A IA não avaliou este critério; considerado ausente.",
    };
  });
}

/** Nota de 0 a 100: média ponderada das notas (0-2) pelos pesos da rubrica. */
export function computeScore(criteria: CriterionResult[]): number {
  const max = criteria.reduce((s, c) => s + 2 * c.weight, 0);
  if (max === 0) return 0;
  const got = criteria.reduce((s, c) => s + c.score * c.weight, 0);
  return Math.round((got / max) * 100);
}
