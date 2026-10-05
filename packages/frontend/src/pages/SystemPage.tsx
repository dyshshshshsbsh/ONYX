import { useEffect, useState } from "react";
import { Activity, Server, Cpu, Bot, Gauge } from "lucide-react";
import { api } from "../services/api";
import { useSystemStore } from "../stores/useSystemStore";
import { formatBytes, formatUptime } from "../utils/format";
import "./SystemPage.css";

interface Diagnostics {
  application: { version: string; uptimeMs: number; backendStatus: string };
  ollama: { connected: boolean; version: string | null; endpoint: string };
  model: { name: string | null; loaded: boolean; contextSize: number | null };
  agent: { conversationId: string | null; state: string; iteration: number; maxIterations: number };
  system: unknown;
}

interface ProcessRow {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryBytes: number;
}

export function SystemPage() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const snapshot = useSystemStore((s) => s.snapshot);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const [diag, procs] = await Promise.all([api.diagnostics.get(), api.system.processes(20)]);
        if (!cancelled) {
          setDiagnostics(diag as unknown as Diagnostics);
          setProcesses(procs.processes);
        }
      } catch {
        /* keep previous values on transient failure */
      }
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="system-page">
      <div className="diagnostics-grid">
        <DiagCard icon={<Server size={14} />} title="Application">
          <DiagRow label="Version" value={diagnostics?.application.version ?? "—"} />
          <DiagRow label="Uptime" value={diagnostics ? formatUptime(diagnostics.application.uptimeMs) : "—"} />
          <DiagRow label="Backend" value={diagnostics?.application.backendStatus ?? "—"} />
        </DiagCard>
        <DiagCard icon={<Gauge size={14} />} title="Ollama">
          <DiagRow label="Connected" value={diagnostics?.ollama.connected ? "Yes" : "No"} />
          <DiagRow label="Version" value={diagnostics?.ollama.version ?? "—"} />
          <DiagRow label="Endpoint" value={diagnostics?.ollama.endpoint ?? "—"} />
        </DiagCard>
        <DiagCard icon={<Cpu size={14} />} title="Model">
          <DiagRow label="Name" value={diagnostics?.model.name ?? "None"} />
          <DiagRow label="Loaded" value={diagnostics?.model.loaded ? "Yes" : "No"} />
          <DiagRow label="Context" value={diagnostics?.model.contextSize ? String(diagnostics.model.contextSize) : "—"} />
        </DiagCard>
        <DiagCard icon={<Bot size={14} />} title="Agent">
          <DiagRow label="State" value={diagnostics?.agent.state ?? "idle"} />
          <DiagRow label="Iteration" value={diagnostics ? `${diagnostics.agent.iteration}/${diagnostics.agent.maxIterations}` : "—"} />
        </DiagCard>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Activity size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Processes
          </span>
          <span className="resource-card-detail">Top 20 by CPU</span>
        </div>
        <table className="process-table">
          <thead>
            <tr>
              <th>PID</th>
              <th>Name</th>
              <th>CPU</th>
              <th>Memory</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.pid}>
                <td className="mono">{p.pid}</td>
                <td>{p.name}</td>
                <td className="mono">{p.cpuPercent.toFixed(1)}%</td>
                <td className="mono">{formatBytes(p.memoryBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {snapshot?.gpu.available === false && (
        <div className="card card-pad" style={{ color: "var(--text-tertiary)" }}>
          GPU metrics unavailable: {snapshot.gpu.unavailableReason}
        </div>
      )}
    </div>
  );
}

function DiagCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card card-pad diag-card">
      <div className="diag-card-title">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="diag-row">
      <span>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
