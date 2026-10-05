import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { ConversationList } from "../components/chat/ConversationList";
import { MessageBubble, StreamingBubble } from "../components/chat/MessageBubble";
import { Composer } from "../components/chat/Composer";
import { useConversationStore } from "../stores/useConversationStore";
import { useModelsStore } from "../stores/useModelsStore";
import { usePromptProfilesStore } from "../stores/usePromptProfilesStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import "./ChatPage.css";

export function ChatPage() {
  const [agentMode, setAgentMode] = useState(false);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversations = useConversationStore((s) => s.conversations);
  const messagesByConversation = useConversationStore((s) => s.messagesByConversation);
  const streamingByConversation = useConversationStore((s) => s.streamingByConversation);
  const loadingMessages = useConversationStore((s) => s.loadingMessages);
  const updateConversationModel = useConversationStore((s) => s.updateConversationModel);
  const updateConversationProfile = useConversationStore((s) => s.updateConversationProfile);
  const createConversation = useConversationStore((s) => s.createConversation);
  const models = useModelsStore((s) => s.models);
  const profiles = usePromptProfilesStore((s) => s.profiles);
  const loadProfiles = usePromptProfilesStore((s) => s.load);
  const settings = useSettingsStore((s) => s.settings);

  const scrollRef = useRef<HTMLDivElement>(null);
  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];
  const streaming = activeConversationId ? streamingByConversation[activeConversationId] : undefined;

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streaming?.content, streaming?.thinking]);

  if (!activeConversationId || !conversation) {
    return (
      <div className="chat-page">
        <ConversationList />
        <div className="chat-main chat-empty">
          <div className="empty-state">
            <div className="empty-state-icon">
              <MessageSquarePlus size={20} />
            </div>
            <p>No conversation selected</p>
            <button
              className="btn btn-primary"
              onClick={() => createConversation(settings?.ai.defaultModel ?? "qwen3:4b", settings?.ai.activeSystemPromptProfileId ?? null)}
            >
              Start a new chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <ConversationList />
      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-header-title">{conversation.title}</div>
          <div className="chat-header-controls">
            <select className="select" style={{ width: 150 }} value={conversation.model} onChange={(e) => updateConversationModel(conversation.id, e.target.value)}>
              {!models.find((m) => m.name === conversation.model) && <option value={conversation.model}>{conversation.model}</option>}
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: 170 }}
              value={conversation.systemPromptProfileId ?? ""}
              onChange={(e) => updateConversationProfile(conversation.id, e.target.value || null)}
            >
              <option value="">No system prompt</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="chat-messages scroll-area" ref={scrollRef}>
          {loadingMessages ? (
            <div className="chat-messages-loading">
              <div className="skeleton" style={{ height: 60, margin: "12px auto", maxWidth: 700 }} />
              <div className="skeleton" style={{ height: 60, margin: "12px auto", maxWidth: 700 }} />
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="empty-state" style={{ paddingTop: 80 }}>
              <p>Say something to get started.</p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {streaming && <StreamingBubble content={streaming.content} thinking={streaming.thinking} />}
            </>
          )}
        </div>

        <Composer model={conversation.model} agentMode={agentMode} onAgentModeChange={setAgentMode} />
      </div>
    </div>
  );
}
