import { create } from "zustand";
import type { AgentEvent, AgentStatus, ChatMessage, Conversation, PendingConfirmation } from "@lacc/shared";
import { api } from "../services/api";
import { wsClient } from "../services/wsClient";
import { useToastStore } from "./useToastStore";

export interface StreamingMessage {
  messageId: string;
  content: string;
  thinking: string;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, ChatMessage[]>;
  streamingByConversation: Record<string, StreamingMessage | undefined>;
  agentStatusByConversation: Record<string, AgentStatus>;
  agentEventsByConversation: Record<string, AgentEvent[]>;
  pendingConfirmations: PendingConfirmation[];
  loadingMessages: boolean;

  loadConversations: () => Promise<void>;
  createConversation: (model: string, systemPromptProfileId: string | null, title?: string) => Promise<Conversation>;
  selectConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  updateConversationModel: (id: string, model: string) => Promise<void>;
  updateConversationProfile: (id: string, systemPromptProfileId: string | null) => Promise<void>;
  archiveConversation: (id: string, archived: boolean) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  sendMessage: (content: string, model: string, agentMode: boolean) => void;
  stop: (conversationId: string) => void;
  resolveConfirmation: (id: string, decision: "allow-once" | "allow-session" | "deny") => void;

  handleChatToken: (conversationId: string, messageId: string, token: string) => void;
  handleThinkingToken: (conversationId: string, messageId: string, token: string) => void;
  handleMessageComplete: (conversationId: string, message: ChatMessage) => void;
  handleChatError: (conversationId: string, error: string) => void;
  handleAgentStatus: (status: AgentStatus) => void;
  handleAgentEvent: (event: AgentEvent) => void;
  handleConfirmationRequired: (confirmation: PendingConfirmation) => void;
  clearConfirmation: (id: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messagesByConversation: {},
  streamingByConversation: {},
  agentStatusByConversation: {},
  agentEventsByConversation: {},
  pendingConfirmations: [],
  loadingMessages: false,

  loadConversations: async () => {
    const { conversations } = await api.conversations.list();
    set({ conversations });
    if (!get().activeConversationId && conversations.length) {
      await get().selectConversation(conversations[0].id);
    }
  },

  createConversation: async (model, systemPromptProfileId, title) => {
    const { conversation } = await api.conversations.create({ model, systemPromptProfileId, title });
    set({ conversations: [conversation, ...get().conversations] });
    await get().selectConversation(conversation.id);
    return conversation;
  },

  selectConversation: async (id) => {
    set({ activeConversationId: id, loadingMessages: true });
    try {
      const { messages } = await api.conversations.messages(id);
      set({ messagesByConversation: { ...get().messagesByConversation, [id]: messages }, loadingMessages: false });
    } catch {
      set({ loadingMessages: false });
    }
  },

  renameConversation: async (id, title) => {
    await api.conversations.update(id, { title });
    set({ conversations: get().conversations.map((c) => (c.id === id ? { ...c, title } : c)) });
  },

  updateConversationModel: async (id, model) => {
    await api.conversations.update(id, { model });
    set({ conversations: get().conversations.map((c) => (c.id === id ? { ...c, model } : c)) });
  },

  updateConversationProfile: async (id, systemPromptProfileId) => {
    await api.conversations.update(id, { systemPromptProfileId });
    set({ conversations: get().conversations.map((c) => (c.id === id ? { ...c, systemPromptProfileId } : c)) });
  },

  archiveConversation: async (id, archived) => {
    await api.conversations.update(id, { archived });
    set({ conversations: get().conversations.filter((c) => c.id !== id || !archived) });
  },

  deleteConversation: async (id) => {
    await api.conversations.remove(id);
    const conversations = get().conversations.filter((c) => c.id !== id);
    const nextActive = get().activeConversationId === id ? conversations[0]?.id ?? null : get().activeConversationId;
    set({ conversations });
    if (nextActive) await get().selectConversation(nextActive);
    else set({ activeConversationId: null });
  },

  sendMessage: (content, model, agentMode) => {
    const conversationId = get().activeConversationId;
    if (!conversationId) return;
    const optimisticMessage: ChatMessage = {
      id: `local-${crypto.randomUUID()}`,
      conversationId,
      role: "user",
      content,
      createdAt: Date.now(),
    };
    const existing = get().messagesByConversation[conversationId] ?? [];
    set({ messagesByConversation: { ...get().messagesByConversation, [conversationId]: [...existing, optimisticMessage] } });
    wsClient.send({ type: "chat:send", conversationId, content, model, agentMode });
  },

  stop: (conversationId) => {
    wsClient.send({ type: "chat:stop", conversationId });
  },

  resolveConfirmation: (id, decision) => {
    wsClient.send({ type: "agent:confirmation-response", confirmationId: id, decision });
    get().clearConfirmation(id);
  },

  handleChatToken: (conversationId, messageId, token) => {
    const current = get().streamingByConversation[conversationId];
    const next: StreamingMessage =
      current && current.messageId === messageId
        ? { ...current, content: current.content + token }
        : { messageId, content: token, thinking: current?.thinking ?? "" };
    set({ streamingByConversation: { ...get().streamingByConversation, [conversationId]: next } });
  },

  handleThinkingToken: (conversationId, messageId, token) => {
    const current = get().streamingByConversation[conversationId];
    const next: StreamingMessage =
      current && current.messageId === messageId
        ? { ...current, thinking: current.thinking + token }
        : { messageId, content: current?.content ?? "", thinking: token };
    set({ streamingByConversation: { ...get().streamingByConversation, [conversationId]: next } });
  },

  handleMessageComplete: (conversationId, message) => {
    const existing = get().messagesByConversation[conversationId] ?? [];
    const withoutUserDup = existing.filter((m) => m.id !== message.id);
    set({
      messagesByConversation: { ...get().messagesByConversation, [conversationId]: [...withoutUserDup, message] },
      streamingByConversation: { ...get().streamingByConversation, [conversationId]: undefined },
    });
    get().loadConversations();
  },

  handleChatError: (conversationId, error) => {
    set({ streamingByConversation: { ...get().streamingByConversation, [conversationId]: undefined } });
    useToastStore.getState().push("error", error);
  },

  handleAgentStatus: (status) => {
    if (!status.conversationId) return;
    set({ agentStatusByConversation: { ...get().agentStatusByConversation, [status.conversationId]: status } });
  },

  handleAgentEvent: (event) => {
    const existing = get().agentEventsByConversation[event.conversationId] ?? [];
    set({
      agentEventsByConversation: {
        ...get().agentEventsByConversation,
        [event.conversationId]: [...existing, event].slice(-500),
      },
    });
  },

  handleConfirmationRequired: (confirmation) => {
    set({ pendingConfirmations: [...get().pendingConfirmations, confirmation] });
  },

  clearConfirmation: (id) => {
    set({ pendingConfirmations: get().pendingConfirmations.filter((c) => c.id !== id) });
  },
}));
