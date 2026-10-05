import { useEffect, useState } from "react";
import { Trash2, ScrollText } from "lucide-react";
import type { LogEntry } from "@lacc/shared";
import { api } from "../services/api";
import { wsClient } from "../services/wsClient";
import { formatTime } from "../utils/format";
import "./LogsPage.css";

const SEVERITY_BADGE: Record<string, string> = {
  debug: "badge",
  info: "badge-accent",
  warn: "badge-warning",
  error: "badge-danger",
};

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");

  useEffect(() => {
    load();
  }, [category, severity]);

  useEffect(() => {
    return wsClient.on((event) => {
      if (event.type === "log:entry") {
        setLogs((prev) => {
          if (category && event.entry.category !== category) return prev;
          if (severity && event.entry.severity !== severity) return prev;
          return [event.entry, ...prev].slice(0, 500);
        });
      }
    });
  }, [category, severity]);

  async function load() {
    const { logs } = await api.logs.list({ limit: 300, category: category || undefined, severity: severity || undefined });
    setLogs(logs);
  }

  async function clear() {
    if (!window.confirm("Clear all logs? This cannot be undone.")) return;
    await api.logs.clear();
    setLogs([]);
  }

  return (
    <div className="logs-page">
      <div className="logs-toolbar">
        <select className="select" style={{ width: 150 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value="app">app</option>
          <option value="ollama">ollama</option>
          <option value="tool">tool</option>
          <option value="agent">agent</option>
          <option value="system">system</option>
          <option value="error">error</option>
        </select>
        <select className="select" style={{ width: 130 }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-danger-ghost" onClick={clear}>
          <Trash2 size={13} /> Clear logs
        </button>
      </div>

      <div className="logs-list scroll-area">
        {logs.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <div className="empty-state-icon">
              <ScrollText size={18} />
            </div>
            <p>No log entries match these filters.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="log-row">
              <span className="log-time mono">{formatTime(log.timestamp)}</span>
              <span className={`badge ${SEVERITY_BADGE[log.severity]}`}>{log.severity}</span>
              <span className="badge">{log.category}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
