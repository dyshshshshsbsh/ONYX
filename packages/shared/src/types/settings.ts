import type { PermissionSettings } from "./tools.js";

export type ThemeMode = "dark" | "light" | "system";
export type LogLevel = "disabled" | "errors" | "standard" | "debug";
export type ConfirmationMode = "always" | "risk-based" | "never";

export interface GeneralSettings {
  theme: ThemeMode;
  language: string;
  launchOnStartup: boolean;
  notificationsEnabled: boolean;
}

export interface AISettings {
  defaultModel: string;
  temperature: number;
  topP: number;
  numCtx: number;
  streaming: boolean;
  showReasoning: boolean;
  activeSystemPromptProfileId: string | null;
}

export interface AgentSettings {
  toolsEnabled: boolean;
  automaticToolExecution: boolean;
  confirmationMode: ConfirmationMode;
  maxIterations: number;
  toolTimeoutMs: number;
}

export interface OllamaSettings {
  endpoint: string;
  keepAliveMinutes: number;
  warmOnStartup: boolean;
}

export interface MonitoringSettings {
  refreshIntervalMs: number;
  historyLengthPoints: number;
  gpuMonitoringEnabled: boolean;
}

export interface SecuritySettings {
  workspaceRoots: string[];
  permissions: PermissionSettings;
  blockedCommandPatterns: string[];
}

export interface AppSettings {
  general: GeneralSettings;
  ai: AISettings;
  agent: AgentSettings;
  ollama: OllamaSettings;
  monitoring: MonitoringSettings;
  security: SecuritySettings;
  logLevel: LogLevel;
}

export interface SystemPromptProfile {
  id: string;
  name: string;
  content: string;
  builtIn: boolean;
  createdAt: number;
  updatedAt: number;
}
