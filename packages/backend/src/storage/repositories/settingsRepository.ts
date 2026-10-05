import os from "node:os";
import path from "node:path";
import type { AppSettings } from "@lacc/shared";
import { DEFAULT_MAX_AGENT_ITERATIONS, DEFAULT_MONITORING_REFRESH_MS, DEFAULT_HISTORY_LENGTH_POINTS, DEFAULT_TOOL_TIMEOUT_MS, DEFAULT_OLLAMA_ENDPOINT } from "@lacc/shared";
import { kvGet, kvSet } from "./kvRepository.js";

const SETTINGS_KEY = "app_settings";

function defaultWorkspaceRoot(): string {
  return path.join(os.homedir(), "Desktop", "MY Agent");
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: "dark",
    language: "en",
    launchOnStartup: false,
    notificationsEnabled: true,
  },
  ai: {
    defaultModel: "qwen3:4b",
    temperature: 0.7,
    topP: 0.9,
    numCtx: 8192,
    streaming: true,
    showReasoning: false,
    activeSystemPromptProfileId: null,
  },
  agent: {
    toolsEnabled: true,
    automaticToolExecution: false,
    confirmationMode: "risk-based",
    maxIterations: DEFAULT_MAX_AGENT_ITERATIONS,
    toolTimeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
  },
  ollama: {
    endpoint: DEFAULT_OLLAMA_ENDPOINT,
    keepAliveMinutes: 5,
  },
  monitoring: {
    refreshIntervalMs: DEFAULT_MONITORING_REFRESH_MS,
    historyLengthPoints: DEFAULT_HISTORY_LENGTH_POINTS,
    gpuMonitoringEnabled: true,
  },
  security: {
    workspaceRoots: [defaultWorkspaceRoot()],
    permissions: {
      fileRead: true,
      fileCreate: true,
      fileModify: true,
      fileDelete: false,
      terminalExecute: true,
      terminalAdmin: false,
      networkAccess: false,
      systemReadInfo: true,
      systemModifySettings: false,
      autoExecuteLowRisk: true,
      confirmMediumRisk: true,
      confirmHighRisk: true,
    },
    blockedCommandPatterns: ["rm -rf /", "format ", "shutdown", "Remove-Item -Recurse -Force C:\\\\$"],
  },
  logLevel: "standard",
};

function deepMerge<T>(base: T, override: Partial<T>): T {
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(override ?? {})) {
    const overrideVal = (override as any)[key];
    const baseVal = (base as any)[key];
    if (overrideVal && typeof overrideVal === "object" && !Array.isArray(overrideVal) && baseVal && typeof baseVal === "object") {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result;
}

export function getSettings(): AppSettings {
  const stored = kvGet<Partial<AppSettings>>(SETTINGS_KEY);
  if (!stored) return DEFAULT_SETTINGS;
  return deepMerge(DEFAULT_SETTINGS, stored);
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = deepMerge(current, partial);
  kvSet(SETTINGS_KEY, next);
  return next;
}

export function resetSettings(): AppSettings {
  kvSet(SETTINGS_KEY, DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
