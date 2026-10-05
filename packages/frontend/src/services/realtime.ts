import { wsClient } from "./wsClient";
import { useSystemStore } from "../stores/useSystemStore";
import { useConversationStore } from "../stores/useConversationStore";
import { useModelsStore } from "../stores/useModelsStore";
import { useToastStore } from "../stores/useToastStore";

let initialized = false;

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
        useConversationStore.getState().handleChatToken(event.conversationId, event.messageId, event.token);
        break;
      case "chat:thinking-token":
        useConversationStore.getState().handleThinkingToken(event.conversationId, event.messageId, event.token);
        break;
      case "chat:message-complete":
        useConversationStore.getState().handleMessageComplete(event.conversationId, event.message);
        break;
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
