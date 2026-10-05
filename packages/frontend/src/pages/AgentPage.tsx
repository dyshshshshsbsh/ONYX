import { useEffect, useMemo, useState } from "react";
import {
  Play,
  Brain,
  Wrench,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldX,
  MessageSquare,
  Flag,
  AlertTriangle,
  OctagonX,
  History,
  type LucideIcon,
} from "lucide-react";
import type { AgentEvent, AgentEventType, ToolCallRecord } from "@lacc/shared";
import { useConversationStore } from "../stores/useConversationStore";
import { api } from "../services/api";
import { formatTime } from "../utils/format";
import { ToolCallBubble } from "../components/chat/ToolCallBubble";
import "./AgentPage.css";

const EVENT_META: Record<AgentEventType, { icon: LucideIcon; label: string; color: string }> = {
  "task-started": { icon: Play, label: "Started task", color: "var(--accent-400)" },
  thinking: { icon: Brain, label: "Thinking", color: "var(--info-500)" },
  "tool-call-requested": { icon: Wrench, label: "Tool requested", color: "var(--text-secondary)" },
  "tool-call-confirmed": { icon: ShieldCheck, label: "Tool confirmed", color: "var(--success-500)" },
  "tool-call-denied": { icon: ShieldX, label: "Tool denied", color: "var(--danger-500)" },
  "tool-call-started": { icon: Wrench, label: "Running tool", color: "var(--info-500)" },
  "tool-call-completed": { icon: CheckCircle2, label: "Tool completed", color: "var(--success-500)" },
  "tool-call-failed": { icon: XCircle, label: "Tool failed", color: "var(--danger-500)" },
  "assistant-message": { icon: MessageSquare, label: "Assistant replied", color: "var(--accent-400)" },
  "task-completed": { icon: Flag, label: "Task completed", color: "var(--success-500)" },
  "task-error": { icon: AlertTriangle, label: "Task error", color: "var(--danger-500)" },
  "task-stopped": { icon: OctagonX, label: "Stopped by user", color: "var(--warning-500)" },
  "iteration-limit-reached": { icon: AlertTriangle, label: "Iteration limit reached", color: "var(--warning-500)" },
};

const ACTIVE_STATES = new Set(["thinking", "calling-tool", "awaiting-confirmation"]);

function summarize(event: AgentEvent): string | null {
  const d = event.data;
  if (typeof d.toolId === "string" && typeof d.args === "object") return `${d.toolId}(${JSON.stringify(d.args)})`;
  if (typeof d.toolId === "string") return String(d.toolId);
  if (typeof d.error === "string") return d.error;
  if (typeof d.userContent === "string") return d.userContent;
  return null;
}

export function AgentPage() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const selectConversation = useConversationStore((s) => s.selectConversation);
  const agentEventsByConversation = useConversationStore((s) => s.agentEventsByConversation);
  const agentStatusByConversation = useConversationStore((s) => s.agentStatusByConversation);
  const stop = useConversationStore((s) => s.stop);
  const loadConversations = useConversationStore((s) => s.loadConversations);
  const [history, setHistory] = useState<ToolCallRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const events = activeConversationId ? agentEventsByConversation[activeConversationId] ?? [] : [];

  // Live events only exist for the life of this browser tab's WebSocket
  // connection. Past tool calls are durable (persisted to SQLite), so load
  // them whenever a conversation has no live events yet — e.g. right after a
  // page refresh, or when switching to a conversation whose agent run
  // happened in an earlier session.
  useEffect(() => {
    if (!activeConversationId || events.length > 0) return;
    setHistoryLoading(true);
    api.conversations
      .toolExecutions(activeConversationId)
      .then((r) => setHistory(r.toolExecutions))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [activeConversationId, events.length]);

  const status = activeConversationId ? agentStatusByConversation[activeConversationId] : undefined;
  const isActive = status && ACTIVE_STATES.has(status.state);

  const reversedEvents = useMemo(() => [...events].reverse(), [events]);

  return (
    <div className="agent-page">
      <div className="agent-page-header">
        <select className="select" style={{ width: 260 }} value={activeConversationId ?? ""} onChange={(e) => selectConversation(e.target.value)}>
          <option value="" disabled>
            Select a conversation…
          </option>
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {status && (
          <span className={`badge ${isActive ? "badge-accent badge-pulse" : "badge"}`}>
            <span className="badge-dot" />
            {status.state} · iteration {status.iteration}/{status.maxIterations}
          </span>
        )}
        {isActive && activeConversationId && (
          <button className="btn btn-danger-ghost" onClick={() => stop(activeConversationId)}>
            Stop
          </button>
        )}
      </div>

      <div className="agent-timeline scroll-area">
        {!activeConversationId ? (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <p>Select a conversation to view its agent activity.</p>
          </div>
        ) : reversedEvents.length === 0 && historyLoading ? (
          <div className="skeleton" style={{ height: 120, margin: "24px 0" }} />
        ) : reversedEvents.length === 0 && history.length > 0 ? (
          <>
            <div className="timeline-history-note">
              <History size={13} />
              Showing past tool calls from this conversation. Live step-by-step activity appears here while a new agent run is in progress.
            </div>
            {history.map((call) => (
              <ToolCallBubble key={call.id} call={call} />
            ))}
          </>
        ) : reversedEvents.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <p>No agent activity yet. Enable Agent Mode in Chat and send a message that needs tools.</p>
          </div>
        ) : (
          reversedEvents.map((event) => {
            const meta = EVENT_META[event.type];
            const Icon = meta.icon;
            const detail = summarize(event);
            return (
              <div key={event.id} className="timeline-row">
                <div className="timeline-time">{formatTime(event.timestamp)}</div>
                <div className="timeline-icon" style={{ color: meta.color }}>
                  <Icon size={14} />
                </div>
                <div className="timeline-body">
                  <div className="timeline-label">{meta.label}</div>
                  {detail && <div className="timeline-detail">{detail.length > 240 ? detail.slice(0, 240) + "…" : detail}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
