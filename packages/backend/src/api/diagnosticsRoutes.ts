import { Router } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ollamaService } from "../container.js";
import { readSystemSnapshot } from "../services/monitoring/SystemMonitor.js";
import { getLastAgentStatus } from "../ws/wsServer.js";

export const diagnosticsRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let appVersion = "0.1.0";
try {
  const pkg = JSON.parse(readFileSync(path.join(__dirname, "../../package.json"), "utf-8"));
  appVersion = pkg.version ?? appVersion;
} catch {
  /* fall back to default */
}

const processStartedAt = Date.now();

diagnosticsRouter.get("/", async (_req, res) => {
  const snapshot = await readSystemSnapshot(ollamaService);
  res.json({
    application: {
      version: appVersion,
      uptimeMs: Date.now() - processStartedAt,
      backendStatus: "running",
    },
    ollama: {
      connected: snapshot.ollama.connected,
      version: snapshot.ollama.version ?? null,
      endpoint: snapshot.ollama.endpoint,
    },
    model: {
      name: snapshot.ollama.loadedModel ?? null,
      loaded: Boolean(snapshot.ollama.loadedModel),
      contextSize: snapshot.ollama.contextSize ?? null,
    },
    agent: getLastAgentStatus() ?? { conversationId: null, state: "idle", iteration: 0, maxIterations: 0 },
    system: {
      cpu: snapshot.cpu,
      memory: snapshot.memory,
      gpu: snapshot.gpu,
    },
  });
});
