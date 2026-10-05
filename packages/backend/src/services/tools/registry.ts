import type { ToolDefinition } from "@lacc/shared";
import { OllamaService } from "../ollama/OllamaService.js";
import { fileTools } from "./fileTools.js";
import { runCommandTool } from "./terminalTool.js";
import { createSystemTools } from "./systemTools.js";
import type { RegisteredTool, ToolContext, ToolHandler } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  constructor(ollama: OllamaService) {
    for (const tool of [...fileTools, runCommandTool, ...createSystemTools(ollama)]) {
      this.register(tool);
    }
  }

  register(tool: RegisteredTool): void {
    this.tools.set(tool.definition.id, tool);
  }

  get(toolId: string): RegisteredTool | undefined {
    return this.tools.get(toolId);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  async execute(toolId: string, args: Record<string, unknown>, context: ToolContext): Promise<unknown> {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`Unknown tool: ${toolId}`);
    // context.toolTimeoutMs is the user-configured "Agent → Tool timeout"
    // setting and is the authoritative ceiling; the tool's own
    // definition.timeoutMs is only a fallback default for callers that
    // don't supply one.
    return runWithTimeout(tool.handler, args, context, context.toolTimeoutMs ?? tool.definition.timeoutMs);
  }
}

function runWithTimeout(handler: ToolHandler, args: Record<string, unknown>, context: ToolContext, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs);
    handler(args, context)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
