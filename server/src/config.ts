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
  appPassword: env("APP_PASSWORD"),
  azdo: {
    org: env("AZDO_ORG"),
    project: env("AZDO_PROJECT"),
    pat: env("AZDO_PAT"),
  },
  aiProvider: resolveProvider(),
  gemini: {
    apiKey: env("GEMINI_API_KEY"),
    model: env("GEMINI_MODEL") || "gemini-3.8-flash",
  },
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

export type AiProvider = "claude" | "gemini" | "mock";

/**
 * AI_PROVIDER manda. Sem ele: AI_MOCK=true -> mock; senão o primeiro provedor
 * com chave configurada (Claude, depois Gemini); sem nenhuma chave -> mock.
 */
function resolveProvider(): AiProvider {
  const p = env("AI_PROVIDER").toLowerCase();
  if (p === "claude" || p === "gemini" || p === "mock") return p;
  if (p) throw new Error(`AI_PROVIDER inválido: "${p}". Use claude, gemini ou mock.`);
  if (env("AI_MOCK").toLowerCase() === "true") return "mock";
  if (env("ANTHROPIC_API_KEY")) return "claude";
  if (env("GEMINI_API_KEY")) return "gemini";
  return "mock";
}
