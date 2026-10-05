import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquarePlus,
  Bot,
  Boxes,
  Wrench,
  Cpu,
  ScrollText,
  Settings,
  RefreshCw,
  Square,
  Search,
} from "lucide-react";
import { useUiStore } from "../stores/useUiStore";
import { useConversationStore } from "../stores/useConversationStore";
import { useModelsStore } from "../stores/useModelsStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import "./CommandPalette.css";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: typeof LayoutDashboard;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const createConversation = useConversationStore((s) => s.createConversation);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const stop = useConversationStore((s) => s.stop);
  const refreshModels = useModelsStore((s) => s.refresh);
  const settings = useSettingsStore((s) => s.settings);

  const commands: Command[] = useMemo(
    () => [
      { id: "nav-dashboard", label: "Open Dashboard", icon: LayoutDashboard, run: () => navigate("/") },
      {
        id: "new-chat",
        label: "New Chat",
        hint: "Ctrl+N",
        icon: MessageSquarePlus,
        run: () => {
          createConversation(settings?.ai.defaultModel ?? "qwen3:4b", settings?.ai.activeSystemPromptProfileId ?? null);
          navigate("/chat");
        },
      },
      { id: "nav-agent", label: "Open Agent Activity", icon: Bot, run: () => navigate("/agent") },
      { id: "nav-models", label: "Open Models", icon: Boxes, run: () => navigate("/models") },
      { id: "nav-tools", label: "Open Tools", icon: Wrench, run: () => navigate("/tools") },
      { id: "nav-system", label: "Open System", icon: Cpu, run: () => navigate("/system") },
      { id: "nav-logs", label: "Open Logs", icon: ScrollText, run: () => navigate("/logs") },
      { id: "nav-settings", label: "Open Settings", hint: "Ctrl+,", icon: Settings, run: () => navigate("/settings") },
      { id: "refresh-models", label: "Refresh Models", icon: RefreshCw, run: () => refreshModels() },
      {
        id: "stop-agent",
        label: "Stop Agent / Generation",
        hint: "Esc",
        icon: Square,
        run: () => activeConversationId && stop(activeConversationId),
      },
    ],
    [navigate, createConversation, settings, refreshModels, activeConversationId, stop]
  );

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [commands, query]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  function execute(cmd: Command) {
    cmd.run();
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && filtered[index]) {
      e.preventDefault();
      execute(filtered[index]);
    }
  }

  return (
    <div className="dialog-overlay" onClick={() => setOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input">
          <Search size={15} style={{ color: "var(--text-tertiary)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search…"
            autoFocus
          />
        </div>
        <div className="command-palette-list">
          {filtered.length === 0 && <div className="empty-state" style={{ padding: 24 }}>No matching commands</div>}
          {filtered.map((cmd, i) => (
            <div key={cmd.id} className="list-row" data-active={i === index} onClick={() => execute(cmd)} onMouseEnter={() => setIndex(i)}>
              <cmd.icon size={15} style={{ color: "var(--text-tertiary)" }} />
              <span style={{ flex: 1 }}>{cmd.label}</span>
              {cmd.hint && <kbd>{cmd.hint}</kbd>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
