import { appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import { HttpError, type CardSource } from "./cards.js";
import { evaluateCard, generateScenarios, loadRubric, toFeatureFile, type LlmClient } from "./ai.js";
import { buildComment } from "./comment.js";
import type { Evaluation, ScenarioSet } from "./types.js";

const FEEDBACK_VERDICTS = ["util", "editado", "descartado"] as const;

export function createApp(cards: CardSource, llm: LlmClient) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const cardId = (req: Request) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID de card inválido.");
    return id;
  };

  app.get("/api/health", (_req, res) => {
    res.json({
      mode: cards.mode,
      project: cards.mode === "azdo" ? `${config.azdo.org}/${config.azdo.project}` : null,
      model: llm.model,
      aiMock: llm.model === "simulado",
      minScore: config.minScore,
    });
  });

  app.get("/api/rubric", async (_req, res) => {
    res.json(await loadRubric());
  });

  app.get("/api/cards", async (_req, res) => {
    res.json(await cards.list());
  });

  app.get("/api/cards/:id", async (req, res) => {
    res.json(await cards.get(cardId(req)));
  });

  app.post("/api/cards/:id/evaluate", async (req, res) => {
    const card = await cards.get(cardId(req));
    res.json(await evaluateCard(llm, card));
  });

  app.post("/api/cards/:id/scenarios", async (req, res) => {
    const card = await cards.get(cardId(req));
    const evaluation = req.body?.evaluation as Evaluation | undefined;
    if (!req.body?.force && evaluation && !evaluation.passed) {
      throw new HttpError(
        409,
        `O card teve nota ${evaluation.score}, abaixo da mínima (${evaluation.minScore}). Refine o card ou gere mesmo assim.`,
      );
    }
    res.json(await generateScenarios(llm, card, evaluation?.questions ?? []));
  });

  app.post("/api/cards/:id/feature", (req, res) => {
    const set = req.body?.scenarios as ScenarioSet | undefined;
    if (!set?.scenarios?.length) throw new HttpError(400, "Nenhum cenário enviado.");
    res
      .type("text/plain; charset=utf-8")
      .attachment(`card-${cardId(req)}.feature`)
      .send(toFeatureFile(set, cardId(req)));
  });

  app.post("/api/cards/:id/publish", async (req, res) => {
    const id = cardId(req);
    const { evaluation, scenarios } = (req.body ?? {}) as { evaluation?: Evaluation; scenarios?: ScenarioSet };
    if (!evaluation && !scenarios) throw new HttpError(400, "Nada para publicar.");
    const html = buildComment(evaluation, scenarios);
    const result = await cards.comment(id, html);
    res.json({ ...result, html });
  });

  // Feedback do QA sobre cada cenário: base da métrica "% aceitos sem edição"
  app.post("/api/feedback", async (req, res) => {
    const { cardId: id, scenarioTitle, verdict, note } = req.body ?? {};
    if (!FEEDBACK_VERDICTS.includes(verdict)) {
      throw new HttpError(400, `verdict deve ser um de: ${FEEDBACK_VERDICTS.join(", ")}`);
    }
    await mkdir(path.dirname(config.paths.feedback), { recursive: true });
    const entry = { at: new Date().toISOString(), cardId: Number(id), scenarioTitle: String(scenarioTitle ?? ""), verdict, note: note ? String(note) : undefined };
    await appendFile(config.paths.feedback, JSON.stringify(entry) + "\n", "utf8");
    res.status(201).json(entry);
  });

  // Em produção, o próprio servidor entrega o front buildado
  if (existsSync(config.paths.web)) {
    app.use(express.static(config.paths.web));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(config.paths.web, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: message });
  });

  return app;
}
