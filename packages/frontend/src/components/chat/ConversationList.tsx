import { useState } from "react";
import { Plus, Search, Trash2, Archive, MessageSquare } from "lucide-react";
import { useConversationStore } from "../../stores/useConversationStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { formatRelativeTime } from "../../utils/format";
import "./ConversationList.css";

export function ConversationList() {
  const [query, setQuery] = useState("");
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const selectConversation = useConversationStore((s) => s.selectConversation);
  const createConversation = useConversationStore((s) => s.createConversation);
  const archiveConversation = useConversationStore((s) => s.archiveConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const settings = useSettingsStore((s) => s.settings);

  const filtered = conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <div className="conversation-search">
          <Search size={13} />
          <input placeholder="Search conversations…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button
          className="btn btn-icon btn-secondary"
          title="New conversation"
          onClick={() => createConversation(settings?.ai.defaultModel ?? "qwen3:4b", settings?.ai.activeSystemPromptProfileId ?? null)}
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="conversation-list-items scroll-area">
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: "32px 12px" }}>
            <div className="empty-state-icon">
              <MessageSquare size={18} />
            </div>
            <p style={{ fontSize: 12.5 }}>No conversations yet</p>
          </div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="conversation-item" data-active={c.id === activeConversationId} onClick={() => selectConversation(c.id)}>
            <div className="conversation-item-main">
              <div className="conversation-item-title">{c.title}</div>
              <div className="conversation-item-meta">
                {c.model} · {formatRelativeTime(c.updatedAt)}
              </div>
            </div>
            <div className="conversation-item-actions">
              <button
                className="btn btn-icon btn-sm btn-ghost"
                title="Archive"
                onClick={(e) => {
                  e.stopPropagation();
                  archiveConversation(c.id, true);
                }}
              >
                <Archive size={12} />
              </button>
              <button
                className="btn btn-icon btn-sm btn-ghost"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${c.title}"? This cannot be undone.`)) deleteConversation(c.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
