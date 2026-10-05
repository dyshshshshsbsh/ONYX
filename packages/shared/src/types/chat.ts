export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCallRecord {
  id: string;
  toolId: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startedAt: number;
  finishedAt?: number;
  riskLevel: "low" | "medium" | "high";
  approved: boolean;
}

export type InferenceProfileName = "fast" | "balanced" | "deep";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  toolCalls?: ToolCallRecord[];
  createdAt: number;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
  tokensPerSecond?: number;
  ttftMs?: number;
  contextTrimmed?: boolean;
  profile?: InferenceProfileName;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  systemPromptProfileId: string | null;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

export interface ChatRequestOptions {
  conversationId: string;
  content: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  numCtx?: number;
  agentMode: boolean;
}
