import { spawn, type ChildProcess } from "node:child_process";
import { logger } from "../logging/Logger.js";

export interface TerminalOutputEvent {
  sessionId: string;
  stream: "stdout" | "stderr";
  chunk: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

export interface TerminalRunOptions {
  sessionId: string;
  command: string;
  cwd: string;
  timeoutMs: number;
  onOutput: (event: TerminalOutputEvent) => void;
  onExit: (event: TerminalExitEvent) => void;
}

export class TerminalService {
  private sessions = new Map<string, ChildProcess>();

  run(options: TerminalRunOptions): void {
    const { sessionId, command, cwd, timeoutMs, onOutput, onExit } = options;
    const startedAt = Date.now();
    let timedOut = false;

    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      env: process.env,
    });

    this.sessions.set(sessionId, child);
    logger.info("tool", `Terminal session started`, { sessionId, command, cwd });

    const timeout = setTimeout(() => {
      timedOut = true;
      this.cancel(sessionId);
    }, timeoutMs);

    child.stdout?.on("data", (data: Buffer) => {
      onOutput({ sessionId, stream: "stdout", chunk: data.toString("utf-8") });
    });
    child.stderr?.on("data", (data: Buffer) => {
      onOutput({ sessionId, stream: "stderr", chunk: data.toString("utf-8") });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      this.sessions.delete(sessionId);
      const durationMs = Date.now() - startedAt;
      logger.info("tool", `Terminal session exited`, { sessionId, exitCode, durationMs, timedOut });
      onExit({ sessionId, exitCode, durationMs, timedOut });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      this.sessions.delete(sessionId);
      logger.error("tool", `Terminal session error`, { sessionId, error: String(err) });
      onOutput({ sessionId, stream: "stderr", chunk: `Failed to start process: ${err.message}` });
      onExit({ sessionId, exitCode: null, durationMs: Date.now() - startedAt, timedOut: false });
    });
  }

  cancel(sessionId: string): boolean {
    const child = this.sessions.get(sessionId);
    if (!child) return false;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"]);
      } else {
        child.kill("SIGKILL");
      }
    } catch (err) {
      logger.error("tool", "Failed to kill terminal session", { sessionId, error: String(err) });
    }
    return true;
  }

  isRunning(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

export const terminalService = new TerminalService();
