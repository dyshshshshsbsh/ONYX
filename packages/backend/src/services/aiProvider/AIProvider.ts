import type { OllamaModelSummary, ToolDefinition } from "@lacc/shared";

export interface ProviderChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

export interface ProviderToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ProviderChatChunk {
  contentDelta: string;
  thinkingDelta?: string;
  /** Authoritative full content text, set only when done:true. Replaces the accumulated deltas rather than extending them. */
  finalContent?: string;
  /** Authoritative full thinking text, set only when done:true. Replaces the accumulated deltas rather than extending them. */
  finalThinking?: string;
  toolCalls?: ProviderToolCall[];
  done: boolean;
  stats?: {
    promptTokens?: number;
    completionTokens?: number;
    totalDurationMs?: number;
    tokensPerSecond?: number;
  };
}

export interface ProviderChatParams {
  model: string;
  messages: ProviderChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  topP?: number;
  numCtx?: number;
  numPredict?: number;
  thinking?: boolean;
  /** e.g. "5m", "0" (unload immediately), "-1" (keep forever). Omitted = Ollama's own default. */
  keepAlive?: string;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<OllamaModelSummary[]>;
  streamChat(params: ProviderChatParams, signal?: AbortSignal): AsyncGenerator<ProviderChatChunk>;
}
