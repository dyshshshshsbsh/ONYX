import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientCommand, ServerEvent } from "@lacc/shared";
import { agentRuntime, systemMonitor } from "../container.js";
import { confirmationBroker } from "../services/agent/ConfirmationBroker.js";
import { terminalService } from "../services/terminal/TerminalService.js";
import { getSettings } from "../storage/repositories/settingsRepository.js";
import { resolveWorkspacePath } from "../services/security/pathValidation.js";
import { assertCommandAllowed } from "../services/security/commandPolicy.js";
import { logger } from "../services/logging/Logger.js";

const clients = new Set<WebSocket>();

let lastAgentStatus: import("@lacc/shared").AgentStatus | null = null;

export function getLastAgentStatus() {
  return lastAgentStatus;
}

export function broadcast(event: ServerEvent): void {
  if (event.type === "agent:status") lastAgentStatus = event.status;
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

let systemMonitorStarted = false;

function ensureSystemMonitorRunning(): void {
  if (systemMonitorStarted) return;
  const settings = getSettings();
  systemMonitor.on("snapshot", (snapshot) => broadcast({ type: "system:snapshot", snapshot }));
  systemMonitor.start(settings.monitoring.refreshIntervalMs);
  systemMonitorStarted = true;
}

export function attachWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    clients.add(socket);
    logger.debug("app", "WebSocket client connected", { totalClients: clients.size });
    ensureSystemMonitorRunning();

    socket.on("message", async (raw) => {
      let command: ClientCommand;
      try {
        command = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (command.type) {
        case "chat:send": {
          const { getConversation, listMessages } = await import("../storage/repositories/conversationRepository.js");
          const { getProfile } = await import("../storage/repositories/promptProfileRepository.js");
          const conversation = getConversation(command.conversationId);
          if (!conversation) {
            broadcast({ type: "chat:error", conversationId: command.conversationId, error: "Conversation not found." });
            return;
          }
          const settings = getSettings();
          const history = listMessages(command.conversationId);
          const profile = conversation.systemPromptProfileId ? getProfile(conversation.systemPromptProfileId) : null;
          const systemPrompt = profile?.content ?? "You are a helpful assistant.";
          agentRuntime.run(
            {
              conversationId: command.conversationId,
              model: command.model,
              systemPrompt,
              history,
              userContent: command.content,
              agentMode: command.agentMode,
              settings,
            },
            broadcast
          );
          break;
        }
        case "chat:stop":
        case "agent:stop":
          agentRuntime.stop(command.conversationId);
          break;
        case "agent:confirmation-response":
          confirmationBroker.resolve(command.confirmationId, command.decision);
          break;
        case "terminal:start": {
          const settings = getSettings();
          if (!settings.security.permissions.terminalExecute) {
            broadcast({ type: "terminal:output", sessionId: command.sessionId, stream: "stderr", chunk: "Terminal execution is disabled in Security settings." });
            broadcast({ type: "terminal:exit", sessionId: command.sessionId, exitCode: null, durationMs: 0 });
            return;
          }
          let cwd: string;
          try {
            assertCommandAllowed(command.command, settings.security.blockedCommandPatterns);
            cwd = resolveWorkspacePath(settings.security.workspaceRoots, command.cwd || ".");
          } catch (err: any) {
            broadcast({ type: "terminal:output", sessionId: command.sessionId, stream: "stderr", chunk: err.message });
            broadcast({ type: "terminal:exit", sessionId: command.sessionId, exitCode: null, durationMs: 0 });
            return;
          }
          terminalService.run({
            sessionId: command.sessionId,
            command: command.command,
            cwd,
            timeoutMs: settings.agent.toolTimeoutMs,
            onOutput: (event) => broadcast({ type: "terminal:output", sessionId: event.sessionId, stream: event.stream, chunk: event.chunk }),
            onExit: (event) => broadcast({ type: "terminal:exit", sessionId: event.sessionId, exitCode: event.exitCode, durationMs: event.durationMs }),
          });
          break;
        }
        case "terminal:cancel":
          terminalService.cancel(command.sessionId);
          break;
        case "subscribe:system":
        case "unsubscribe:system":
          break;
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
      logger.debug("app", "WebSocket client disconnected", { totalClients: clients.size });
    });
  });
}
