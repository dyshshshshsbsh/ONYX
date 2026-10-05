import { Router } from "express";
import * as repo from "../storage/repositories/logRepository.js";
import { logger } from "../services/logging/Logger.js";

export const logsRouter = Router();

logsRouter.get("/", (req, res) => {
  const { limit, category, severity } = req.query as { limit?: string; category?: string; severity?: string };
  res.json({ logs: repo.listLogs({ limit: limit ? Number(limit) : undefined, category, severity }) });
});

logsRouter.delete("/", (_req, res) => {
  logger.clear();
  res.json({ cleared: true });
});
