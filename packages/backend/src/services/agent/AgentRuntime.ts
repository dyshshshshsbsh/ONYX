import { randomUUID } from "node:crypto";
import type {
  AgentEvent,
  AgentEventType,
  AppSettings,
  ChatMessage,
  InferenceProfileName,
  PendingConfirmation,
  ServerEvent,
  ToolCallRecord,
} from "@lacc/shared";
import type { AIProvider, ProviderChatMessage } from "../aiProvider/AIProvider.js";
import { ToolRegistry } from "../tools/registry.js";
import { permissionManager } from "../security/PermissionManager.js";
import { confirmationBroker } from "./ConfirmationBroker.js";
import { ollamaRuntimeTracker } from "../monitoring/OllamaRuntimeTracker.js";
import { getInferenceProfile } from "../aiProvider/InferenceProfiles.js";
import { buildInferenceContext } from "./ContextManager.js";
import type { ModelCapabilityService } from "../ollama/ModelCapabilityService.js";
import * as conversationRepo from "../../storage/repositories/conversationRepository.js";
import * as toolExecRepo from "../../storage/repositories/toolExecutionRepository.js";
import { logger } from "../logging/Logger.js";

export interface AgentRunParams {
  conversationId: string;
  model: string;
  systemPrompt: string;
  history: ChatMessage[];
  userContent: string;
  agentMode: boolean;
  settings: AppSettings;
  profile: InferenceProfileName;
}

type Emit = (event: ServerEvent) => void;

function describeToolCall(toolName: string, args: Record<string, unknown>): string {
  const argsPreview = JSON.stringify(args);
  return `${toolName}(${argsPreview.length > 140 ? argsPreview.slice(0, 140) + "…" : argsPreview})`;
}

export class AgentRuntime {
  private abortControllers = new Map<string, AbortController>();

  constructor(private provider: AIProvider, private toolRegistry: ToolRegistry, private capabilities: ModelCapabilityService) {}

  stop(conversationId: string): void {
    this.abortControllers.get(conversationId)?.abort();
  }

  private makeAgentEvent(conversationId: string, type: AgentEventType, iteration: number, data: Record<string, unknown>): AgentEvent {
    return { id: randomUUID(), conversationId, type, timestamp: Date.now(), iteration, data };
  }

  async run(params: AgentRunParams, emit: Emit): Promise<void> {
    const { conversationId, model, systemPrompt, history, userContent, agentMode, settings, profile: profileName } = params;

    // Hardware-aware safety valve (Phase 14): this machine cannot usefully
    // run more than one local generation at a time, so a second concurrent
    // request is rejected with a clear error rather than silently queued or
    // allowed to contend for the same CPU/GPU.
    const busyWith = ollamaRuntimeTracker.tryAcquire(conversationId);
    if (busyWith) {
      emit({ type: "chat:error", conversationId, error: "Another response is already generating. Wait for it to finish or stop it first." });
      return;
    }

    const abortController = new AbortController();
    this.abortControllers.set(conversationId, abortController);

    const userMessage: ChatMessage = {
      id: randomUUID(),
      conversationId,
      role: "user",
      content: userContent,
      createdAt: Date.now(),
    };
    conversationRepo.insertMessage(userMessage);

    const profile = await getInferenceProfile(profileName);
    const modelSupportsThinking = await this.capabilities.supportsThinking(model);
    const effectiveThink = profile.think && modelSupportsThinking;

    const fullHistory = [...history, userMessage];
    const contextResult = buildInferenceContext(systemPrompt, fullHistory, profile.numCtx);
    const providerMessages: ProviderChatMessage[] = contextResult.messages;

    const useTools = agentMode && settings.agent.toolsEnabled;
    const maxIterations = useTools ? settings.agent.maxIterations : 1;
    let iteration = 0;

    try {
      emit({ type: "agent:status", status: { conversationId, state: "thinking", iteration, maxIterations } });
      if (agentMode) {
        emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "task-started", iteration, { userContent }) });
      }

      while (iteration < maxIterations) {
        iteration += 1;
        const assistantMessageId = randomUUID();
        let content = "";
        let thinking = "";
        const toolCallRecords: ToolCallRecord[] = [];

        const requestStartedAt = Date.now();
        let firstTokenAt: number | null = null;
        ollamaRuntimeTracker.beginRequest(conversationId);
        let lastStats: { promptTokens?: number; completionTokens?: number; tokensPerSecond?: number } = {};

        try {
          const stream = this.provider.streamChat(
            {
              model,
              messages: providerMessages,
              tools: useTools ? this.toolRegistry.list() : undefined,
              temperature: profile.temperature,
              topP: profile.topP,
              numCtx: profile.numCtx,
              numPredict: profile.numPredict,
              thinking: effectiveThink,
              keepAlive: `${Math.max(1, settings.ollama.keepAliveMinutes)}m`,
            },
            abortController.signal
          );

          const collectedToolCalls: { name: string; arguments: Record<string, unknown> }[] = [];

          for await (const chunk of stream) {
            if ((chunk.contentDelta || chunk.thinkingDelta) && firstTokenAt === null) {
              firstTokenAt = Date.now();
              ollamaRuntimeTracker.recordTtft(firstTokenAt - requestStartedAt);
            }
            if (chunk.contentDelta) {
              content += chunk.contentDelta;
              emit({ type: "chat:token", conversationId, messageId: assistantMessageId, token: chunk.contentDelta });
            }
            if (chunk.thinkingDelta) {
              thinking += chunk.thinkingDelta;
              emit({ type: "chat:thinking-token", conversationId, messageId: assistantMessageId, token: chunk.thinkingDelta });
            }
            if (chunk.toolCalls?.length) {
              collectedToolCalls.push(...chunk.toolCalls);
            }
            if (chunk.done) {
              // The provider's final chunk carries the authoritative full
              // text (recomputed once the whole response is known), which
              // can disagree with what the incremental deltas above
              // produced for edge cases like an orphaned closing think tag.
              // It replaces the accumulated values rather than extending them.
              if (chunk.finalContent !== undefined) content = chunk.finalContent;
              if (chunk.finalThinking !== undefined) thinking = chunk.finalThinking;
              if (chunk.stats) {
                lastStats = chunk.stats;
                ollamaRuntimeTracker.endRequest(chunk.stats.totalDurationMs ?? Date.now() - requestStartedAt, chunk.stats.tokensPerSecond);
              }
            }
          }

          if (collectedToolCalls.length === 0) {
            ollamaRuntimeTracker.endRequest(Date.now() - requestStartedAt, undefined);
          }

          if (collectedToolCalls.length > 0 && useTools) {
            providerMessages.push({ role: "assistant", content: content || "" });

            let shouldStop = false;
            for (const call of collectedToolCalls) {
              const record = await this.handleToolCall(conversationId, call, settings, iteration, emit);
              toolCallRecords.push(record);
              providerMessages.push({
                role: "tool",
                toolName: record.toolId,
                content: record.error ? `Error: ${record.error}` : JSON.stringify(record.result ?? null),
              });
              if (record.error === "Stopped by user") shouldStop = true;
            }

            const assistantMsg: ChatMessage = {
              id: assistantMessageId,
              conversationId,
              role: "assistant",
              content,
              thinking: thinking || undefined,
              toolCalls: toolCallRecords,
              createdAt: Date.now(),
              model,
            };
            conversationRepo.insertMessage(assistantMsg);

            if (shouldStop) {
              emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "task-stopped", iteration, {}) });
              emit({ type: "agent:status", status: { conversationId, state: "stopped", iteration, maxIterations } });
              return;
            }
            continue;
          }

          const finalMessage: ChatMessage = {
            id: assistantMessageId,
            conversationId,
            role: "assistant",
            content,
            thinking: thinking || undefined,
            toolCalls: toolCallRecords.length ? toolCallRecords : undefined,
            createdAt: Date.now(),
            model,
            promptTokens: lastStats.promptTokens,
            completionTokens: lastStats.completionTokens,
            durationMs: Date.now() - requestStartedAt,
            tokensPerSecond: lastStats.tokensPerSecond,
            ttftMs: firstTokenAt !== null ? firstTokenAt - requestStartedAt : undefined,
            contextTrimmed: contextResult.trimmed,
            profile: profileName,
          };
          conversationRepo.insertMessage(finalMessage);
          conversationRepo.touchConversation(conversationId);

          emit({ type: "chat:message-complete", conversationId, message: finalMessage });
          if (agentMode) {
            emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "assistant-message", iteration, { messageId: finalMessage.id }) });
            emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "task-completed", iteration, {}) });
          }
          emit({ type: "agent:status", status: { conversationId, state: "idle", iteration, maxIterations } });
          return;
        } catch (err: any) {
          ollamaRuntimeTracker.endRequest(Date.now() - requestStartedAt, undefined);
          if (err?.name === "AbortError") {
            emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "task-stopped", iteration, {}) });
            emit({ type: "agent:status", status: { conversationId, state: "stopped", iteration, maxIterations } });
            return;
          }
          logger.error("agent", "Agent run failed", { error: String(err?.message ?? err) });
          emit({ type: "chat:error", conversationId, error: err?.message ?? "Unknown error" });
          emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "task-error", iteration, { error: String(err?.message ?? err) }) });
          emit({ type: "agent:status", status: { conversationId, state: "error", iteration, maxIterations } });
          return;
        }
      }

      emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "iteration-limit-reached", iteration, { maxIterations }) });
      emit({ type: "agent:status", status: { conversationId, state: "completed", iteration, maxIterations } });
    } finally {
      this.abortControllers.delete(conversationId);
    }
  }

  private async handleToolCall(
    conversationId: string,
    call: { name: string; arguments: Record<string, unknown> },
    settings: AppSettings,
    iteration: number,
    emit: Emit
  ): Promise<ToolCallRecord> {
    const record: ToolCallRecord = {
      id: randomUUID(),
      toolId: call.name,
      args: call.arguments,
      startedAt: Date.now(),
      riskLevel: "low",
      approved: false,
    };

    const tool = this.toolRegistry.get(call.name);
    if (!tool) {
      record.error = `Unknown tool: ${call.name}`;
      record.finishedAt = Date.now();
      emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "tool-call-failed", iteration, { toolId: call.name, error: record.error }) });
      return record;
    }
    record.riskLevel = tool.definition.riskLevel;

    emit({
      type: "agent:event",
      event: this.makeAgentEvent(conversationId, "tool-call-requested", iteration, {
        toolId: tool.definition.id,
        toolName: tool.definition.name,
        args: call.arguments,
        riskLevel: tool.definition.riskLevel,
      }),
    });

    const verdict = permissionManager.evaluate(tool.definition, settings.security.permissions, settings.agent);

    if (verdict === "deny") {
      record.error = `Permission denied: ${tool.definition.name} is disabled in Security settings.`;
      record.finishedAt = Date.now();
      emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "tool-call-denied", iteration, { toolId: tool.definition.id, reason: "disabled" }) });
      toolExecRepo.insertToolExecution(conversationId, record);
      return record;
    }

    if (verdict === "confirm") {
      const confirmation: PendingConfirmation = {
        id: randomUUID(),
        toolId: tool.definition.id,
        toolName: tool.definition.name,
        args: call.arguments,
        riskLevel: tool.definition.riskLevel,
        summary: describeToolCall(tool.definition.name, call.arguments),
        createdAt: Date.now(),
      };
      emit({ type: "agent:confirmation-required", confirmation });
      emit({ type: "agent:status", status: { conversationId, state: "awaiting-confirmation", iteration, maxIterations: settings.agent.maxIterations, currentTool: tool.definition.id } });

      const decision = await confirmationBroker.await(confirmation.id);
      if (decision === "deny") {
        record.error = "Denied by user.";
        record.finishedAt = Date.now();
        emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "tool-call-denied", iteration, { toolId: tool.definition.id, reason: "user" }) });
        toolExecRepo.insertToolExecution(conversationId, record);
        return record;
      }
      if (decision === "allow-session") permissionManager.grantSession(tool.definition.id);
      emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "tool-call-confirmed", iteration, { toolId: tool.definition.id, decision }) });
    }

    record.approved = true;
    toolExecRepo.insertToolExecution(conversationId, record);
    emit({ type: "agent:event", event: this.makeAgentEvent(conversationId, "tool-call-started", iteration, { toolId: tool.definition.id }) });
    emit({ type: "agent:status", status: { conversationId, state: "calling-tool", iteration, maxIterations: settings.agent.maxIterations, currentTool: tool.definition.id } });

    try {
      const result = await this.toolRegistry.execute(call.name, call.arguments, {
        workspaceRoots: settings.security.workspaceRoots,
        conversationId,
        toolTimeoutMs: settings.agent.toolTimeoutMs,
        blockedCommandPatterns: settings.security.blockedCommandPatterns,
        onTerminalOutput: (event) => emit({ type: "terminal:output", sessionId: event.sessionId, stream: event.stream, chunk: event.chunk }),
      });
      record.result = result;
      record.finishedAt = Date.now();
      toolExecRepo.updateToolExecution(record);
      emit({
        type: "agent:event",
        event: this.makeAgentEvent(conversationId, "tool-call-completed", iteration, { toolId: tool.definition.id, result }),
      });
      return record;
    } catch (err: any) {
      record.error = err?.message ?? String(err);
      record.finishedAt = Date.now();
      toolExecRepo.updateToolExecution(record);
      emit({
        type: "agent:event",
        event: this.makeAgentEvent(conversationId, "tool-call-failed", iteration, { toolId: tool.definition.id, error: record.error }),
      });
      return record;
    }
  }
}
