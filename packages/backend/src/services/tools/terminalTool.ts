import { randomUUID } from "node:crypto";
import { resolveWorkspacePath } from "../security/pathValidation.js";
import { assertCommandAllowed } from "../security/commandPolicy.js";
import { terminalService } from "../terminal/TerminalService.js";
import type { RegisteredTool } from "./types.js";

export const runCommandTool: RegisteredTool = {
  definition: {
    id: "run_command",
    name: "Run Command",
    description: "Execute a shell command inside an approved workspace directory and return its stdout, stderr, and exit code.",
    category: "terminal",
    riskLevel: "high",
    timeoutMs: 30_000,
    schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute." },
        cwd: { type: "string", description: "Working directory (workspace-relative or absolute). Defaults to the primary workspace root." },
      },
      required: ["command"],
    },
  },
  async handler(args, context) {
    assertCommandAllowed(String(args.command), context.blockedCommandPatterns);
    const cwd = resolveWorkspacePath(context.workspaceRoots, String(args.cwd ?? "."));
    const sessionId = randomUUID();
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    return new Promise((resolve) => {
      terminalService.run({
        sessionId,
        command: String(args.command),
        cwd,
        timeoutMs: context.toolTimeoutMs,
        onOutput: (event) => {
          if (event.stream === "stdout") stdoutChunks.push(event.chunk);
          else stderrChunks.push(event.chunk);
          context.onTerminalOutput?.(event);
        },
        onExit: (event) => {
          resolve({
            command: args.command,
            cwd,
            exitCode: event.exitCode,
            durationMs: event.durationMs,
            timedOut: event.timedOut,
            stdout: stdoutChunks.join("").slice(0, 20_000),
            stderr: stderrChunks.join("").slice(0, 20_000),
          });
        },
      });
    });
  },
};
