import { HardDrive, Cpu, Zap } from "lucide-react";
import { useSystemStore } from "../stores/useSystemStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useConversationStore } from "../stores/useConversationStore";
import "./StatusBar.css";

const ACTIVE_STATES = new Set(["thinking", "calling-tool", "awaiting-confirmation"]);

export function StatusBar() {
  const snapshot = useSystemStore((s) => s.snapshot);
  const settings = useSettingsStore((s) => s.settings);
  const agentStatuses = useConversationStore((s) => s.agentStatusByConversation);

  const agentRunning = Object.values(agentStatuses).some((s) => ACTIVE_STATES.has(s.state));
  const ollama = snapshot?.ollama;

  return (
    <footer className="statusbar">
      <div className="statusbar-item">
        <span className="badge-dot" style={{ color: ollama?.connected ? "var(--success-500)" : "var(--danger-500)" }} />
        Ollama {ollama?.connected ? "Connected" : "Offline"}
        {ollama?.version && <span className="statusbar-dim">v{ollama.version}</span>}
      </div>
      <div className="statusbar-sep" />
      <div className="statusbar-item">
        <Cpu size={12} />
        Model: {ollama?.loadedModel ?? settings?.ai.defaultModel ?? "—"}
      </div>
      <div className="statusbar-sep" />
      <div className="statusbar-item">
        <HardDrive size={12} />
        CPU {snapshot ? Math.round(snapshot.cpu.utilizationPercent) : "—"}% · RAM {snapshot ? Math.round(snapshot.memory.percent) : "—"}%
      </div>
      {agentRunning && (
        <>
          <div className="statusbar-sep" />
          <div className="statusbar-item statusbar-accent">
            <Zap size={12} />
            Agent running
          </div>
        </>
      )}
      <div className="statusbar-spacer" />
      <div className="statusbar-item statusbar-dim">Local · Offline-capable</div>
    </footer>
  );
}
