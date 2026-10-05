export type AgentRunState = "idle" | "thinking" | "calling-tool" | "awaiting-confirmation" | "completed" | "error" | "stopped";

export type AgentEventType =
  | "task-started"
  | "thinking"
  | "tool-call-requested"
  | "tool-call-confirmed"
  | "tool-call-denied"
  | "tool-call-started"
  | "tool-call-completed"
  | "tool-call-failed"
  | "assistant-message"
  | "task-completed"
  | "task-error"
  | "task-stopped"
  | "iteration-limit-reached";

export interface AgentEvent {
  id: string;
  conversationId: string;
  type: AgentEventType;
  timestamp: number;
  iteration: number;
  data: Record<string, unknown>;
}

export interface AgentStatus {
  conversationId: string | null;
  state: AgentRunState;
  iteration: number;
  maxIterations: number;
  currentTool?: string;
  startedAt?: number;
}
