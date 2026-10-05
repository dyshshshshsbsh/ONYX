import { useState } from "react";
import { Plus, X, RotateCcw } from "lucide-react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { PermissionsPanel } from "../components/PermissionsPanel";
import { SystemPromptManager } from "../components/settings/SystemPromptManager";
import { SettingField, SettingSection } from "../components/settings/SettingField";
import "./SettingsPage.css";

const SECTIONS = ["General", "AI", "Agent", "System Prompts", "Ollama", "Monitoring", "Security"] as const;

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <span className="switch" data-on={on} onClick={onToggle}>
      <span className="switch-thumb" />
    </span>
  );
}

export function SettingsPage() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("General");
  const { settings, update, reset } = useSettingsStore();
  const [newWorkspace, setNewWorkspace] = useState("");
  const [newPattern, setNewPattern] = useState("");

  if (!settings) return null;

  return (
    <div className="settings-page">
      <div className="settings-nav">
        {SECTIONS.map((s) => (
          <div key={s} className="settings-nav-item" data-active={s === section} onClick={() => setSection(s)}>
            {s}
          </div>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: "auto", color: "var(--text-tertiary)" }}
          onClick={() => window.confirm("Reset all settings to defaults?") && reset()}
        >
          <RotateCcw size={12} /> Reset to defaults
        </button>
      </div>

      <div className="settings-content scroll-area">
        {section === "General" && (
          <SettingSection title="General">
            <SettingField label="Theme" description="Dark, light, or follow the system.">
              <select className="select" value={settings.general.theme} onChange={(e) => update({ general: { ...settings.general, theme: e.target.value as any } })}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </SettingField>
            <SettingField label="Launch on startup" description="Start the backend automatically when Windows starts.">
              <Switch on={settings.general.launchOnStartup} onToggle={() => update({ general: { ...settings.general, launchOnStartup: !settings.general.launchOnStartup } })} />
            </SettingField>
            <SettingField label="Notifications" description="Show toast notifications for background events.">
              <Switch on={settings.general.notificationsEnabled} onToggle={() => update({ general: { ...settings.general, notificationsEnabled: !settings.general.notificationsEnabled } })} />
            </SettingField>
          </SettingSection>
        )}

        {section === "AI" && (
          <SettingSection title="AI">
            <SettingField label="Default model" description="Used for new conversations.">
              <input className="input" style={{ width: 180 }} value={settings.ai.defaultModel} onChange={(e) => update({ ai: { ...settings.ai, defaultModel: e.target.value } })} />
            </SettingField>
            <SettingField label="Temperature" description={`Higher is more creative. Current: ${settings.ai.temperature}`}>
              <input
                className="slider"
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={settings.ai.temperature}
                onChange={(e) => update({ ai: { ...settings.ai, temperature: Number(e.target.value) } })}
                style={{ width: 160 }}
              />
            </SettingField>
            <SettingField label="Top P" description={`Current: ${settings.ai.topP}`}>
              <input
                className="slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.ai.topP}
                onChange={(e) => update({ ai: { ...settings.ai, topP: Number(e.target.value) } })}
                style={{ width: 160 }}
              />
            </SettingField>
            <SettingField label="Context size" description="Tokens of context the model can see.">
              <input
                className="input"
                type="number"
                style={{ width: 100 }}
                value={settings.ai.numCtx}
                onChange={(e) => update({ ai: { ...settings.ai, numCtx: Number(e.target.value) } })}
              />
            </SettingField>
            <SettingField label="Streaming" description="Stream tokens as they are generated.">
              <Switch on={settings.ai.streaming} onToggle={() => update({ ai: { ...settings.ai, streaming: !settings.ai.streaming } })} />
            </SettingField>
            <SettingField label="Show reasoning" description="Request & display the model's thinking trace. Slower on modest hardware.">
              <Switch on={settings.ai.showReasoning} onToggle={() => update({ ai: { ...settings.ai, showReasoning: !settings.ai.showReasoning } })} />
            </SettingField>
          </SettingSection>
        )}

        {section === "Agent" && (
          <SettingSection title="Agent">
            <SettingField label="Enable tools" description="Allow the agent to use tools at all.">
              <Switch on={settings.agent.toolsEnabled} onToggle={() => update({ agent: { ...settings.agent, toolsEnabled: !settings.agent.toolsEnabled } })} />
            </SettingField>
            <SettingField label="Automatic tool execution" description="Auto-run low-risk tools without confirmation (still gated by Security permissions).">
              <Switch
                on={settings.agent.automaticToolExecution}
                onToggle={() => update({ agent: { ...settings.agent, automaticToolExecution: !settings.agent.automaticToolExecution } })}
              />
            </SettingField>
            <SettingField label="Confirmation mode" description="How often the agent must ask before acting.">
              <select
                className="select"
                value={settings.agent.confirmationMode}
                onChange={(e) => update({ agent: { ...settings.agent, confirmationMode: e.target.value as any } })}
              >
                <option value="always">Always confirm</option>
                <option value="risk-based">Risk-based</option>
                <option value="never">Never confirm</option>
              </select>
            </SettingField>
            <SettingField label="Maximum iterations" description="Hard cap on agent tool-call loops per task.">
              <input
                className="input"
                type="number"
                style={{ width: 90 }}
                value={settings.agent.maxIterations}
                onChange={(e) => update({ agent: { ...settings.agent, maxIterations: Number(e.target.value) } })}
              />
            </SettingField>
            <SettingField label="Tool timeout (ms)" description="Maximum time a single tool call may run.">
              <input
                className="input"
                type="number"
                style={{ width: 110 }}
                value={settings.agent.toolTimeoutMs}
                onChange={(e) => update({ agent: { ...settings.agent, toolTimeoutMs: Number(e.target.value) } })}
              />
            </SettingField>
          </SettingSection>
        )}

        {section === "System Prompts" && (
          <SettingSection title="System Prompt Profiles">
            <SystemPromptManager />
          </SettingSection>
        )}

        {section === "Ollama" && (
          <SettingSection title="Ollama">
            <SettingField label="Endpoint" description="Base URL of the Ollama server.">
              <input className="input" style={{ width: 220 }} value={settings.ollama.endpoint} onChange={(e) => update({ ollama: { ...settings.ollama, endpoint: e.target.value } })} />
            </SettingField>
            <SettingField label="Keep-alive (minutes)" description="How long Ollama keeps the model loaded after use.">
              <input
                className="input"
                type="number"
                style={{ width: 90 }}
                value={settings.ollama.keepAliveMinutes}
                onChange={(e) => update({ ollama: { ...settings.ollama, keepAliveMinutes: Number(e.target.value) } })}
              />
            </SettingField>
            <SettingField label="Warm model on startup" description="Preload the default model into memory when the backend starts, so the first real message doesn't pay the model-load latency.">
              <Switch on={settings.ollama.warmOnStartup} onToggle={() => update({ ollama: { ...settings.ollama, warmOnStartup: !settings.ollama.warmOnStartup } })} />
            </SettingField>
            <div className="settings-info-note">
              <strong>Flash Attention / KV-cache quantization</strong> are set via environment variables when the Ollama
              service itself starts (<code className="inline-code">OLLAMA_FLASH_ATTENTION=1</code>,{" "}
              <code className="inline-code">OLLAMA_KV_CACHE_TYPE=q8_0</code>), not through per-request API options — this
              app cannot toggle them at runtime without restarting Ollama with those variables set. Set them in Windows
              under System Environment Variables, then restart the Ollama service, if your hardware benefits from them.
            </div>
          </SettingSection>
        )}

        {section === "Monitoring" && (
          <SettingSection title="Monitoring">
            <SettingField label="Refresh interval (ms)" description="How often system metrics are sampled.">
              <input
                className="input"
                type="number"
                style={{ width: 100 }}
                value={settings.monitoring.refreshIntervalMs}
                onChange={(e) => update({ monitoring: { ...settings.monitoring, refreshIntervalMs: Number(e.target.value) } })}
              />
            </SettingField>
            <SettingField label="History length (points)" description="How many samples to keep for dashboard charts.">
              <input
                className="input"
                type="number"
                style={{ width: 100 }}
                value={settings.monitoring.historyLengthPoints}
                onChange={(e) => update({ monitoring: { ...settings.monitoring, historyLengthPoints: Number(e.target.value) } })}
              />
            </SettingField>
            <SettingField label="GPU monitoring" description="Query nvidia-smi for GPU/VRAM metrics.">
              <Switch on={settings.monitoring.gpuMonitoringEnabled} onToggle={() => update({ monitoring: { ...settings.monitoring, gpuMonitoringEnabled: !settings.monitoring.gpuMonitoringEnabled } })} />
            </SettingField>
          </SettingSection>
        )}

        {section === "Security" && (
          <>
            <SettingSection title="Workspace Roots">
              <p className="card-subtitle" style={{ marginBottom: 10 }}>
                The agent and file tools may only access paths inside these directories.
              </p>
              <div className="workspace-list">
                {settings.security.workspaceRoots.map((root) => (
                  <div key={root} className="workspace-item">
                    <span className="mono">{root}</span>
                    <button
                      className="btn btn-icon btn-sm btn-ghost"
                      onClick={() =>
                        update({ security: { ...settings.security, workspaceRoots: settings.security.workspaceRoots.filter((r) => r !== root) } })
                      }
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="input-row" style={{ marginTop: 8 }}>
                <input className="input" placeholder="C:\Path\To\Workspace" value={newWorkspace} onChange={(e) => setNewWorkspace(e.target.value)} />
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (!newWorkspace.trim()) return;
                    update({ security: { ...settings.security, workspaceRoots: [...settings.security.workspaceRoots, newWorkspace.trim()] } });
                    setNewWorkspace("");
                  }}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </SettingSection>

            <SettingSection title="Permissions">
              <PermissionsPanel />
            </SettingSection>

            <SettingSection title="Confirmation Defaults">
              <SettingField label="Auto-execute low risk" description="Skip confirmation for low-risk tools when automatic execution is on.">
                <Switch
                  on={settings.security.permissions.autoExecuteLowRisk}
                  onToggle={() => update({ security: { ...settings.security, permissions: { ...settings.security.permissions, autoExecuteLowRisk: !settings.security.permissions.autoExecuteLowRisk } } })}
                />
              </SettingField>
              <SettingField label="Confirm medium risk" description="Require confirmation for medium-risk tools.">
                <Switch
                  on={settings.security.permissions.confirmMediumRisk}
                  onToggle={() => update({ security: { ...settings.security, permissions: { ...settings.security.permissions, confirmMediumRisk: !settings.security.permissions.confirmMediumRisk } } })}
                />
              </SettingField>
              <SettingField label="Confirm high risk" description="Require confirmation for high-risk tools.">
                <Switch
                  on={settings.security.permissions.confirmHighRisk}
                  onToggle={() => update({ security: { ...settings.security, permissions: { ...settings.security.permissions, confirmHighRisk: !settings.security.permissions.confirmHighRisk } } })}
                />
              </SettingField>
            </SettingSection>

            <SettingSection title="Blocked Command Patterns">
              <div className="workspace-list">
                {settings.security.blockedCommandPatterns.map((pattern) => (
                  <div key={pattern} className="workspace-item">
                    <span className="mono">{pattern}</span>
                    <button
                      className="btn btn-icon btn-sm btn-ghost"
                      onClick={() =>
                        update({ security: { ...settings.security, blockedCommandPatterns: settings.security.blockedCommandPatterns.filter((p) => p !== pattern) } })
                      }
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="input-row" style={{ marginTop: 8 }}>
                <input className="input" placeholder="substring to block, e.g. format C:" value={newPattern} onChange={(e) => setNewPattern(e.target.value)} />
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (!newPattern.trim()) return;
                    update({ security: { ...settings.security, blockedCommandPatterns: [...settings.security.blockedCommandPatterns, newPattern.trim()] } });
                    setNewPattern("");
                  }}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </SettingSection>
          </>
        )}
      </div>
    </div>
  );
}
