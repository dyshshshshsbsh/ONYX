import type { ToolDefinition } from "@lacc/shared";
import type { TerminalOutputEvent } from "../terminal/TerminalService.js";

export interface ToolContext {
  workspaceRoots: string[];
  conversationId: string;
  onTerminalOutput?: (event: TerminalOutputEvent) => void;
  toolTimeoutMs: number;
  blockedCommandPatterns: string[];
}

export type ToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
