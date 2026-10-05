import { Router } from "express";
import { ollamaService } from "../container.js";
import { broadcast } from "../ws/wsServer.js";
import { logger } from "../services/logging/Logger.js";

export const modelsRouter = Router();

modelsRouter.get("/", async (_req, res) => {
  try {
    const models = await ollamaService.listModels();
    res.json({ models });
  } catch (err: any) {
    res.status(503).json({ error: err.message ?? "Ollama unavailable" });
  }
});

modelsRouter.get("/running", async (_req, res) => {
  try {
    const models = await ollamaService.runningModels();
    res.json({ models });
  } catch (err: any) {
    res.status(503).json({ error: err.message ?? "Ollama unavailable" });
  }
});

modelsRouter.get("/:name/show", async (req, res) => {
  try {
    const info = await ollamaService.showModel(req.params.name);
    res.json(info);
  } catch (err: any) {
    res.status(503).json({ error: err.message ?? "Ollama unavailable" });
  }
});

modelsRouter.post("/pull", async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: "Missing model name." });
    return;
  }
  res.status(202).json({ started: true, model: name });

  (async () => {
    try {
      for await (const progress of ollamaService.pullModel(name)) {
        broadcast({ type: "model:pull-progress", progress });
        if (progress.error) {
          broadcast({ type: "notification", level: "error", message: `Failed to pull ${name}: ${progress.error}` });
          return;
        }
      }
      broadcast({ type: "notification", level: "success", message: `Model ${name} installed.` });
    } catch (err: any) {
      logger.error("ollama", "Model pull failed", { model: name, error: String(err) });
      broadcast({ type: "notification", level: "error", message: `Failed to pull ${name}: ${err.message}` });
    }
  })();
});

modelsRouter.delete("/:name", async (req, res) => {
  try {
    await ollamaService.deleteModel(req.params.name);
    broadcast({ type: "notification", level: "success", message: `Model ${req.params.name} removed.` });
    res.json({ removed: true });
  } catch (err: any) {
    res.status(503).json({ error: err.message ?? "Ollama unavailable" });
  }
});
