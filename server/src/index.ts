import { config } from "./config.js";
import { createCardSource } from "./cards.js";
import { createAnthropicClient } from "./ai.js";
import { createApp } from "./app.js";
import { createMockClient } from "./mock.js";

const cards = createCardSource();
const llm = config.aiMock ? createMockClient() : createAnthropicClient();
const app = createApp(cards, llm);

app.listen(config.port, () => {
  console.log(`Card Validator API em http://localhost:${config.port}`);
  console.log(
    cards.mode === "azdo"
      ? `Azure DevOps: ${config.azdo.org}/${config.azdo.project}`
      : "Modo demo: usando samples/cards.json (configure AZDO_* no .env para usar o Azure DevOps)",
  );
  if (config.aiMock) console.warn("IA SIMULADA: respostas prontas, sem chamar a API (AI_MOCK=true ou sem ANTHROPIC_API_KEY).");
});
