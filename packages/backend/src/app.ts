import express from "express";
import cors from "cors";
import { modelsRouter } from "./api/modelsRoutes.js";
import { conversationsRouter } from "./api/conversationsRoutes.js";
import { promptProfilesRouter } from "./api/promptProfilesRoutes.js";
import { settingsRouter } from "./api/settingsRoutes.js";
import { toolsRouter } from "./api/toolsRoutes.js";
import { fsRouter } from "./api/fsRoutes.js";
import { systemRouter } from "./api/systemRoutes.js";
import { logsRouter } from "./api/logsRoutes.js";
import { diagnosticsRouter } from "./api/diagnosticsRoutes.js";
import { logger } from "./services/logging/Logger.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/models", modelsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/prompt-profiles", promptProfilesRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/tools", toolsRouter);
  app.use("/api/fs", fsRouter);
  app.use("/api/system", systemRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/diagnostics", diagnosticsRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("error", "Unhandled API error", { error: String(err?.message ?? err), stack: err?.stack });
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
