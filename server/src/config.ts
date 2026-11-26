import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

// server/src (dev) ou server/dist (build) -> server/
export const SERVER_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const REPO_ROOT = path.resolve(SERVER_ROOT, "..");

dotenv.config({ path: path.join(REPO_ROOT, ".env") });

const env = (name: string) => (process.env[name] ?? "").trim();

export const config = {
  port: Number(env("PORT") || 3001),
  minScore: Number(env("MIN_SCORE") || 70),
  azdo: {
    org: env("AZDO_ORG"),
    project: env("AZDO_PROJECT"),
    pat: env("AZDO_PAT"),
  },
  /** IA simulada: AI_MOCK=true ou ausência de chave */
  aiMock: env("AI_MOCK").toLowerCase() === "true" || !env("ANTHROPIC_API_KEY"),
  anthropic: {
    apiKey: env("ANTHROPIC_API_KEY"),
    model: env("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
  },
  paths: {
    rubric: path.join(SERVER_ROOT, "config", "rubric.json"),
    prompts: path.join(SERVER_ROOT, "prompts"),
    samples: path.join(REPO_ROOT, "samples", "cards.json"),
    feedback: path.join(REPO_ROOT, "data", "feedback.jsonl"),
    web: path.join(REPO_ROOT, "web", "dist"),
  },
};

export const azdoEnabled = () =>
  Boolean(config.azdo.org && config.azdo.project && config.azdo.pat);
