import type { LlmClient } from "./ai.js";
import { HttpError } from "./cards.js";

/**
 * Adaptador para a API do Gemini (Google AI Studio), via REST.
 * Usa function calling com modo ANY para forçar a resposta estruturada,
 * equivalente ao tool_choice do Claude.
 *
 * ATENÇÃO: no free tier o Google pode usar entradas e saídas para melhorar os
 * produtos dele, com revisão humana. Use só com cards de exemplo ou internos.
 */
export function createGeminiClient(apiKey: string, model: string): LlmClient {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  return {
    model,
    async callTool({ system, user, tool, maxTokens }) {
      if (!apiKey) throw new HttpError(500, "GEMINI_API_KEY não configurada no .env.");

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          tools: [
            {
              functionDeclarations: [
                { name: tool.name, description: tool.description, parameters: toGeminiSchema(tool.input_schema) },
              ],
            },
          ],
          toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [tool.name] } },
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }).catch((e: Error) => {
        throw new HttpError(502, `Não foi possível conectar ao Gemini (${e.message}). Verifique a internet ou o proxy da rede.`);
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 429) {
          throw new HttpError(429, "Limite do free tier do Gemini atingido. Aguarde um minuto ou veja as cotas em aistudio.google.com/rate-limit.");
        }
        if (res.status === 400 || res.status === 403 || res.status === 404) {
          throw new HttpError(502, `Gemini respondeu ${res.status}. Verifique a GEMINI_API_KEY e se o modelo "${model}" existe e está no seu plano. ${body.slice(0, 300)}`);
        }
        throw new HttpError(502, `Gemini respondeu ${res.status}. ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as GeminiResponse;
      const candidate = data.candidates?.[0];
      const call = candidate?.content?.parts?.find((p) => p.functionCall)?.functionCall;
      if (!call?.args) {
        const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? "desconhecido";
        throw new HttpError(502, `O Gemini não devolveu uma resposta estruturada (motivo: ${reason}). Tente de novo.`);
      }
      return call.args;
    },
  };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

/**
 * O Gemini aceita um subconjunto do OpenAPI Schema: `enum` só vale para strings.
 * Remove `enum` de campos não-string (a nota 0-2 já é normalizada no código).
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  const s = schema as Record<string, unknown>;
  for (const [key, value] of Object.entries(s)) {
    if (key === "enum" && s.type !== "string") continue;
    out[key] = key === "properties"
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toGeminiSchema(v)]))
      : toGeminiSchema(value);
  }
  return out;
}
