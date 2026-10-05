import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachWebSocketServer } from "./ws/wsServer.js";
import { logger } from "./services/logging/Logger.js";
import { systemMonitor } from "./container.js";
import { db } from "./storage/db.js";
import { DEFAULT_BACKEND_PORT } from "@lacc/shared";

const port = Number(process.env.LACC_BACKEND_PORT) || DEFAULT_BACKEND_PORT;

const app = createApp();
const server = createServer(app);
attachWebSocketServer(server);

server.listen(port, () => {
  logger.info("app", `Local AI Command Center backend listening on http://localhost:${port}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("app", `Received ${signal}, shutting down backend.`);
  systemMonitor.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Force-exit if close() hangs (e.g. an open keep-alive socket).
  setTimeout(() => {
    db.close();
    process.exit(0);
  }, 2000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
