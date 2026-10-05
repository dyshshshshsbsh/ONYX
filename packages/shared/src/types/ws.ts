import type { ChatMessage } from "./chat.js";
import type { AgentEvent, AgentStatus } from "./agent.js";
import type { SystemSnapshot } from "./system.js";
import type { PendingConfirmation } from "./tools.js";
import type { LogEntry } from "./logs.js";
import type { ModelPullProgress } from "./models.js";

export type ServerEvent =
  | { type: "chat:token"; conversationId: string; messageId: string; token: string }
  | { type: "chat:thinking-token"; conversationId: string; messageId: string; token: string }
  | { type: "chat:message-complete"; conversationId: string; message: ChatMessage }
  | { type: "chat:error"; conversationId: string; error: string }
  | { type: "agent:event"; event: AgentEvent }
  | { type: "agent:status"; status: AgentStatus }
  | { type: "agent:confirmation-required"; confirmation: PendingConfirmation }
  | { type: "system:snapshot"; snapshot: SystemSnapshot }
  | { type: "terminal:output"; sessionId: string; stream: "stdout" | "stderr"; chunk: string }
  | { type: "terminal:exit"; sessionId: string; exitCode: number | null; durationMs: number }
  | { type: "model:pull-progress"; progress: ModelPullProgress }
  | { type: "log:entry"; entry: LogEntry }
  | { type: "notification"; level: "success" | "warning" | "error" | "info"; message: string };

export type ClientCommand =
  | { type: "chat:send"; conversationId: string; content: string; model: string; agentMode: boolean }
  | { type: "chat:stop"; conversationId: string }
  | { type: "agent:confirmation-response"; confirmationId: string; decision: "allow-once" | "allow-session" | "deny" }
  | { type: "agent:stop"; conversationId: string }
  | { type: "terminal:start"; sessionId: string; command: string; cwd: string }
  | { type: "terminal:cancel"; sessionId: string }
  | { type: "subscribe:system" }
  | { type: "unsubscribe:system" };
