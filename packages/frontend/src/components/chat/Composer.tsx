import { useRef, useState } from "react";
import { Send, Square, Bot, Zap, Scale, Brain } from "lucide-react";
import type { InferenceProfileName } from "@lacc/shared";
import { useConversationStore } from "../../stores/useConversationStore";
import { useModelsStore } from "../../stores/useModelsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import "./Composer.css";

const ACTIVE_STATES = new Set(["thinking", "calling-tool", "awaiting-confirmation"]);

const PROFILES: Array<{ id: InferenceProfileName; label: string; icon: typeof Zap; title: string }> = [
  { id: "fast", label: "Fast", icon: Zap, title: "Quickest answers: thinking off, short context, short generation budget." },
  { id: "balanced", label: "Balanced", icon: Scale, title: "Normal use: moderate context and generation budget." },
  { id: "deep", label: "Deep", icon: Brain, title: "Full reasoning enabled for hard problems. Slower — use when you need it." },
];

function readStoredProfile(): InferenceProfileName {
  try {
    const stored = localStorage.getItem("onyx.inferenceProfile");
    if (stored === "fast" || stored === "balanced" || stored === "deep") return stored;
  } catch {
    /* localStorage unavailable; fall back to default */
  }
  return "balanced";
}

export function Composer({ model, agentMode, onAgentModeChange }: { model: string; agentMode: boolean; onAgentModeChange: (v: boolean) => void }) {
  const [value, setValue] = useState("");
  const [profile, setProfile] = useState<InferenceProfileName>(readStoredProfile);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const sendMessage = useConversationStore((s) => s.sendMessage);
  const stop = useConversationStore((s) => s.stop);
  const agentStatus = useConversationStore((s) => (activeConversationId ? s.agentStatusByConversation[activeConversationId] : undefined));
  const streaming = useConversationStore((s) => (activeConversationId ? Boolean(s.streamingByConversation[activeConversationId]) : false));
  const models = useModelsStore((s) => s.models);
  const settings = useSettingsStore((s) => s.settings);

  const isBusy = streaming || (agentStatus && ACTIVE_STATES.has(agentStatus.state));

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  function handleSend() {
    if (!value.trim() || !activeConversationId || isBusy) return;
    sendMessage(value.trim(), model, agentMode, profile);
    setValue("");
    requestAnimationFrame(autoResize);
  }

  function handleProfileChange(next: InferenceProfileName) {
    setProfile(next);
    try {
      localStorage.setItem("onyx.inferenceProfile", next);
    } catch {
      /* localStorage unavailable; preference just won't persist across reloads */
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="composer">
      <div className="composer-toolbar">
        <button
          className={`agent-mode-toggle ${agentMode ? "agent-mode-on" : ""}`}
          onClick={() => onAgentModeChange(!agentMode)}
          disabled={!settings?.agent.toolsEnabled}
          title={settings?.agent.toolsEnabled ? "Toggle agent tool use" : "Tools are disabled in Settings → Agent"}
        >
          <Bot size={13} />
          Agent Mode
          <span className="switch" data-on={agentMode} style={{ marginLeft: 4 }}>
            <span className="switch-thumb" />
          </span>
        </button>
        <div className="profile-switch" role="radiogroup" aria-label="Inference profile">
          {PROFILES.map(({ id, label, icon: Icon, title }) => (
            <button
              key={id}
              className={`profile-switch-option ${profile === id ? "profile-switch-active" : ""}`}
              onClick={() => handleProfileChange(id)}
              title={title}
              role="radio"
              aria-checked={profile === id}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
        <span className="composer-model-badge">{model}</span>
        {models.length === 0 && <span className="composer-hint">No models detected — check Ollama</span>}
      </div>
      <div className="composer-input-row">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder={agentMode ? "Ask the agent to do something with tools…" : "Message the model…"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={!activeConversationId}
        />
        {isBusy ? (
          <button className="btn btn-danger composer-send" onClick={() => activeConversationId && stop(activeConversationId)}>
            <Square size={14} />
          </button>
        ) : (
          <button className="btn btn-primary composer-send" onClick={handleSend} disabled={!value.trim() || !activeConversationId}>
            <Send size={14} />
          </button>
        )}
      </div>
      <div className="composer-footnote">Ctrl+Enter to send · Esc to stop</div>
    </div>
  );
}
