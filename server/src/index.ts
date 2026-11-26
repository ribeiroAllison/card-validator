import { config } from "./config.js";
import { createCardSource } from "./cards.js";
import { createAnthropicClient } from "./ai.js";
import { createApp } from "./app.js";

const cards = createCardSource();
const app = createApp(cards, createAnthropicClient());

app.listen(config.port, () => {
  console.log(`Card Validator API em http://localhost:${config.port}`);
  console.log(
    cards.mode === "azdo"
      ? `Azure DevOps: ${config.azdo.org}/${config.azdo.project}`
      : "Modo demo: usando samples/cards.json (configure AZDO_* no .env para usar o Azure DevOps)",
  );
  if (!config.anthropic.apiKey) console.warn("Atenção: ANTHROPIC_API_KEY não configurada.");
});
