import { wsClient } from "./wsClient";
import { useSystemStore } from "../stores/useSystemStore";
import { useConversationStore } from "../stores/useConversationStore";
import { useModelsStore } from "../stores/useModelsStore";
import { useToastStore } from "../stores/useToastStore";

let initialized = false;

// Streamed tokens can arrive far faster than the UI needs to repaint (a fast
// model can emit many tokens within a single animation frame). Dispatching a
// zustand state update — and the React re-render it triggers — on every
// single WS message was a real source of jank and wasted CPU that competes
// with Ollama's own inference threads on this machine. Instead we buffer
// incoming deltas per message and flush at most once per animation frame.
interface PendingFlush {
  conversationId: string;
  messageId: string;
  content: string;
  thinking: string;
  rafId: number | null;
}
const pendingFlushes = new Map<string, PendingFlush>();

function scheduleFlush(key: string): void {
  const pending = pendingFlushes.get(key);
  if (!pending || pending.rafId !== null) return;
  pending.rafId = requestAnimationFrame(() => {
    const current = pendingFlushes.get(key);
    if (!current) return;
    current.rafId = null;
    if (current.content) {
      useConversationStore.getState().handleChatToken(current.conversationId, current.messageId, current.content);
      current.content = "";
    }
    if (current.thinking) {
      useConversationStore.getState().handleThinkingToken(current.conversationId, current.messageId, current.thinking);
      current.thinking = "";
    }
  });
}

export function initializeRealtime(): void {
  if (initialized) return;
  initialized = true;

  wsClient.onConnectionChange((connected) => {
    useSystemStore.getState().setConnected(connected);
  });

  wsClient.on((event) => {
    switch (event.type) {
      case "system:snapshot":
        useSystemStore.getState().applySnapshot(event.snapshot);
        break;
      case "chat:token":
      case "chat:thinking-token": {
        const key = `${event.conversationId}:${event.messageId}`;
        let pending = pendingFlushes.get(key);
        if (!pending) {
          pending = { conversationId: event.conversationId, messageId: event.messageId, content: "", thinking: "", rafId: null };
          pendingFlushes.set(key, pending);
        }
        if (event.type === "chat:token") pending.content += event.token;
        else pending.thinking += event.token;
        scheduleFlush(key);
        break;
      }
      case "chat:message-complete": {
        const key = `${event.conversationId}:${event.message.id}`;
        const pending = pendingFlushes.get(key);
        if (pending?.rafId !== null && pending?.rafId !== undefined) cancelAnimationFrame(pending.rafId);
        pendingFlushes.delete(key);
        useConversationStore.getState().handleMessageComplete(event.conversationId, event.message);
        break;
      }
      case "chat:error":
        useConversationStore.getState().handleChatError(event.conversationId, event.error);
        break;
      case "agent:status":
        useConversationStore.getState().handleAgentStatus(event.status);
        break;
      case "agent:event":
        useConversationStore.getState().handleAgentEvent(event.event);
        break;
      case "agent:confirmation-required":
        useConversationStore.getState().handleConfirmationRequired(event.confirmation);
        break;
      case "model:pull-progress":
        useModelsStore.getState().applyPullProgress(event.progress);
        break;
      case "notification":
        useToastStore.getState().push(event.level, event.message);
        break;
      default:
        break;
    }
  });

  wsClient.connect();
}
