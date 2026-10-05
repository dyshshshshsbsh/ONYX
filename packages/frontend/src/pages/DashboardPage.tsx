import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, MemoryStick, Gauge, Layers, Sparkles, MessageSquarePlus, Bot, Boxes, AlertTriangle } from "lucide-react";
import { useSystemStore } from "../stores/useSystemStore";
import { useConversationStore } from "../stores/useConversationStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { ResourceCard } from "../components/ResourceCard";
import { api } from "../services/api";
import { formatBytes, formatRelativeTime, formatTokensPerSecond } from "../utils/format";
import "./DashboardPage.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const snapshot = useSystemStore((s) => s.snapshot);
  const applySnapshot = useSystemStore((s) => s.applySnapshot);
  const cpuHistory = useSystemStore((s) => s.cpuHistory);
  const memHistory = useSystemStore((s) => s.memHistory);
  const gpuUtilHistory = useSystemStore((s) => s.gpuUtilHistory);
  const gpuVramHistory = useSystemStore((s) => s.gpuVramHistory);
  const conversations = useConversationStore((s) => s.conversations);
  const createConversation = useConversationStore((s) => s.createConversation);
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    if (!snapshot) {
      api.system.snapshot().then((r) => applySnapshot(r.snapshot)).catch(() => {});
    }
  }, []);

  async function handleNewChat() {
    await createConversation(settings?.ai.defaultModel ?? "qwen3:4b", settings?.ai.activeSystemPromptProfileId ?? null);
    navigate("/chat");
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-quick-actions">
        <button className="btn btn-primary" onClick={handleNewChat}>
          <MessageSquarePlus size={15} /> New Chat
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/agent")}>
          <Bot size={15} /> Agent Activity
        </button>
        <button className="btn btn-secondary" onClick={() => navigate("/models")}>
          <Boxes size={15} /> Manage Models
        </button>
      </div>

      <div className="dashboard-grid">
        <ResourceCard
          icon={<Cpu size={15} />}
          title="CPU"
          value={snapshot?.cpu.utilizationPercent ?? null}
          subtitle={snapshot ? `${snapshot.cpu.modelName}` : undefined}
          detail={snapshot ? `${snapshot.cpu.logicalCores} logical processors` : undefined}
          history={cpuHistory}
        />
        <ResourceCard
          icon={<MemoryStick size={15} />}
          title="Memory"
          value={snapshot?.memory.percent ?? null}
          subtitle={snapshot ? `${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}` : undefined}
          history={memHistory}
        />
        <ResourceCard
          icon={<Gauge size={15} />}
          title={snapshot?.gpu.name ?? "GPU"}
          value={snapshot?.gpu.available ? snapshot.gpu.utilizationPercent ?? 0 : null}
          subtitle={snapshot?.gpu.available ? `Driver ${snapshot.gpu.driverVersion}` : undefined}
          detail={snapshot?.gpu.available && snapshot.gpu.temperatureC ? `${snapshot.gpu.temperatureC}°C` : undefined}
          history={gpuUtilHistory}
          unavailableReason={!snapshot?.gpu.available ? snapshot?.gpu.unavailableReason ?? "Detecting GPU…" : undefined}
        />
        <ResourceCard
          icon={<Layers size={15} />}
          title="VRAM"
          value={snapshot?.gpu.available ? snapshot.gpu.vramPercent ?? 0 : null}
          subtitle={
            snapshot?.gpu.available ? `${formatBytes(snapshot.gpu.vramUsedBytes ?? 0)} / ${formatBytes(snapshot.gpu.vramTotalBytes ?? 0)}` : undefined
          }
          history={gpuVramHistory}
          unavailableReason={!snapshot?.gpu.available ? snapshot?.gpu.unavailableReason ?? "Detecting GPU…" : undefined}
        />
      </div>

      <div className="dashboard-lower">
        <div className="card card-pad dashboard-runtime-card">
          <div className="card-header" style={{ padding: 0, border: "none", marginBottom: 14 }}>
            <span className="card-title">
              <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              AI Runtime
            </span>
            <span className={`badge ${snapshot?.ollama.connected ? "badge-success" : "badge-danger"}`}>
              <span className="badge-dot" />
              {snapshot?.ollama.connected ? "Connected" : "Offline"}
            </span>
          </div>
          {snapshot?.ollama.connected ? (
            <div className="runtime-grid">
              <RuntimeStat label="Loaded model" value={snapshot.ollama.loadedModel ?? "None"} />
              <RuntimeStat label="Model state" value={snapshot.ollama.modelState ?? "unknown"} />
              <RuntimeStat label="Model size" value={snapshot.ollama.loadedModelSizeBytes ? formatBytes(snapshot.ollama.loadedModelSizeBytes) : "—"} />
              <RuntimeStat label="Ollama version" value={snapshot.ollama.version ?? "—"} />
              <RuntimeStat label="Active requests" value={String(snapshot.ollama.activeRequests)} />
              <RuntimeStat label="Time to first token" value={snapshot.ollama.lastTtftMs ? `${(snapshot.ollama.lastTtftMs / 1000).toFixed(2)}s` : "—"} />
              <RuntimeStat label="Last request" value={snapshot.ollama.lastRequestDurationMs ? `${(snapshot.ollama.lastRequestDurationMs / 1000).toFixed(1)}s` : "—"} />
              <RuntimeStat label="Last speed" value={formatTokensPerSecond(snapshot.ollama.lastTokensPerSecond)} />
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <p>Ollama is offline. Start Ollama and try again.</p>
            </div>
          )}
          {snapshot?.ollama.hardwareWarning && (
            <div className="dashboard-hardware-warning">
              <AlertTriangle size={13} />
              {snapshot.ollama.hardwareWarning}
            </div>
          )}
        </div>

        <div className="card card-pad dashboard-recent-card">
          <div className="card-header" style={{ padding: 0, border: "none", marginBottom: 14 }}>
            <span className="card-title">Recent Conversations</span>
          </div>
          {conversations.length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <p>No conversations yet.</p>
            </div>
          ) : (
            <div className="dashboard-recent-list">
              {conversations.slice(0, 6).map((c) => (
                <div key={c.id} className="list-row" onClick={() => navigate("/chat")}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                  <span className="resource-card-detail" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                    {formatRelativeTime(c.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RuntimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="runtime-stat">
      <div className="runtime-stat-label">{label}</div>
      <div className="runtime-stat-value">{value}</div>
    </div>
  );
}
