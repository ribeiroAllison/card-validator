import { config } from "./config.js";
import { createCardSource } from "./cards.js";
import { createAnthropicClient } from "./ai.js";
import { createApp } from "./app.js";
import { createMockClient } from "./mock.js";
import { createGeminiClient } from "./gemini.js";

const cards = createCardSource();
const llm =
  config.aiProvider === "mock"
    ? createMockClient()
    : config.aiProvider === "gemini"
      ? createGeminiClient(config.gemini.apiKey, config.gemini.model)
      : createAnthropicClient();
const app = createApp(cards, llm);

app.listen(config.port, () => {
  console.log(`Card Validator API em http://localhost:${config.port}`);
  console.log(
    cards.mode === "azdo"
      ? `Azure DevOps: ${config.azdo.org}/${config.azdo.project}`
      : "Modo demo: usando samples/cards.json (configure AZDO_* no .env para usar o Azure DevOps)",
  );
  console.log(`IA: ${config.aiProvider} (${llm.model})`);
  if (config.aiProvider === "mock") console.warn("IA SIMULADA: respostas prontas, sem chamar nenhuma API.");
  if (config.aiProvider === "gemini" && cards.mode === "azdo") {
    console.warn("Atenção: no free tier do Gemini o Google pode usar os dados enviados. Não use cards de clientes.");
  }
});
