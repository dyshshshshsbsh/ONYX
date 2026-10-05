import { Router } from "express";
import type { AppSettings } from "@lacc/shared";
import * as repo from "../storage/repositories/settingsRepository.js";
import { ollamaService, systemMonitor } from "../container.js";
import { logger } from "../services/logging/Logger.js";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  res.json({ settings: repo.getSettings() });
});

settingsRouter.patch("/", (req, res) => {
  const partial = req.body as Partial<AppSettings>;
  const updated = repo.updateSettings(partial);
  applySideEffects(updated);
  res.json({ settings: updated });
});

settingsRouter.post("/reset", (_req, res) => {
  const reset = repo.resetSettings();
  applySideEffects(reset);
  res.json({ settings: reset });
});

function applySideEffects(settings: AppSettings): void {
  ollamaService.setBaseUrl(settings.ollama.endpoint);
  logger.setLevel(settings.logLevel);
  systemMonitor.start(settings.monitoring.refreshIntervalMs);
}
