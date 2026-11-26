import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { HttpError } from "./errors.js";
import { evaluateWith, generateWith, type LlmClient } from "./core.js";
import type { Card, Evaluation, Rubric, ScenarioSet } from "./types.js";

export type { LlmClient } from "./core.js";
export { toFeatureFile, rubricToText, cardToText } from "./core.js";

export function createAnthropicClient(): LlmClient {
  if (!config.anthropic.apiKey) {
    return {
      model: config.anthropic.model,
      async callTool() {
        throw new HttpError(500, "ANTHROPIC_API_KEY não configurada no .env.");
      },
    };
  }
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  return {
    model: config.anthropic.model,
    async callTool({ system, user, tool, maxTokens }) {
      const res = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: maxTokens,
        system,
        tools: [tool as Anthropic.Tool],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: user }],
      });
      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") {
        throw new HttpError(502, "A IA não devolveu uma resposta estruturada.");
      }
      return block.input as Record<string, unknown>;
    },
  };
}

// ---------------------------------------------------------------------------

export async function loadRubric(): Promise<Rubric> {
  return JSON.parse(await readFile(config.paths.rubric, "utf8")) as Rubric;
}

async function loadPrompt(name: string) {
  return readFile(path.join(config.paths.prompts, `${name}.md`), "utf8");
}

export async function evaluateCard(llm: LlmClient, card: Card): Promise<Evaluation> {
  return evaluateWith(llm, card, await loadRubric(), await loadPrompt("evaluate"), config.minScore);
}

export async function generateScenarios(llm: LlmClient, card: Card, openQuestions: string[] = []): Promise<ScenarioSet> {
  return generateWith(llm, card, await loadPrompt("generate"), openQuestions);
}
