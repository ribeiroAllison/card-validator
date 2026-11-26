export interface Card {
  id: number;
  title: string;
  type: string;
  state: string;
  /** HTML como vem do Azure DevOps */
  description: string;
  /** HTML como vem do Azure DevOps */
  acceptanceCriteria: string;
  url?: string;
}

export interface CardSummary {
  id: number;
  title: string;
  type: string;
  state: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  weight: number;
  description: string;
  levels: Record<"0" | "1" | "2", string>;
}

export interface Rubric {
  version: string;
  scale: string;
  criteria: RubricCriterion[];
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
  /** 0 a 100, calculada pelo código a partir das notas por critério */
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
