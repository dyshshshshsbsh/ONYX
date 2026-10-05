import type { OllamaModelSummary } from "@lacc/shared";
import { OllamaService } from "../ollama/OllamaService.js";
import type { OllamaToolSpec } from "../ollama/types.js";
import type { AIProvider, ProviderChatChunk, ProviderChatParams } from "./AIProvider.js";
import { ThinkTagSplitter, splitThinkTagsFull } from "./ThinkTagSplitter.js";

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  readonly label = "Ollama (local)";

  constructor(private service: OllamaService) {}

  async isAvailable(): Promise<boolean> {
    return this.service.health();
  }

  async listModels(): Promise<OllamaModelSummary[]> {
    return this.service.listModels();
  }

  async *streamChat(params: ProviderChatParams, signal?: AbortSignal): AsyncGenerator<ProviderChatChunk> {
    const tools: OllamaToolSpec[] | undefined = params.tools?.map((t) => ({
      type: "function",
      function: {
        name: t.id,
        description: t.description,
        parameters: t.schema,
      },
    }));

    const startedAt = Date.now();
    const stream = this.service.streamChat(
      {
        model: params.model,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content, tool_name: m.toolName })),
        tools,
        think: params.thinking,
        keep_alive: params.keepAlive,
        options: {
          temperature: params.temperature,
          top_p: params.topP,
          num_ctx: params.numCtx,
          num_predict: params.numPredict,
        },
      },
      signal
    );

    const splitter = new ThinkTagSplitter();
    let rawContent = "";
    let rawThinking = "";

    for await (const chunk of stream) {
      const toolCalls = chunk.message.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      rawContent += chunk.message.content ?? "";
      rawThinking += chunk.message.thinking ?? "";

      const split = splitter.feed(chunk.message.content ?? "");
      let contentDelta = split.content;
      let thinkingDelta = (chunk.message.thinking ?? "") + split.thinking;

      const result: ProviderChatChunk = {
        contentDelta,
        thinkingDelta: thinkingDelta || undefined,
        toolCalls,
        done: chunk.done,
      };

      if (chunk.done) {
        // Some Ollama/model combinations (observed with qwen3) emit a
        // literal "</think>" with no matching opening tag, which the
        // incremental splitter above can't detect until it's too late. Now
        // that the full text is known, recompute the authoritative split and
        // hand it over as a full replacement rather than another delta.
        const authoritative = splitThinkTagsFull(rawContent);
        result.finalContent = authoritative.content;
        result.finalThinking = rawThinking + authoritative.thinking || undefined;
      }

      if (chunk.done) {
        const totalDurationMs = chunk.total_duration ? chunk.total_duration / 1_000_000 : Date.now() - startedAt;
        const evalCount = chunk.eval_count ?? 0;
        const evalDurationS = (chunk.eval_duration ?? 0) / 1_000_000_000;
        result.stats = {
          promptTokens: chunk.prompt_eval_count,
          completionTokens: chunk.eval_count,
          totalDurationMs,
          tokensPerSecond: evalDurationS > 0 ? evalCount / evalDurationS : undefined,
        };
      }

      yield result;
    }
  }
}
