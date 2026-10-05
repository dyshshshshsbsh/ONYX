export type RiskLevel = "low" | "medium" | "high";

export type ToolCategory = "filesystem" | "terminal" | "system" | "network";

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  schema: ToolParameterSchema;
  timeoutMs: number;
}

export interface ToolExecutionRequest {
  toolId: string;
  args: Record<string, unknown>;
  conversationId: string;
}

export interface ToolExecutionResult {
  toolId: string;
  callId: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export type PermissionDecision = "allow-once" | "allow-session" | "deny";

export interface PendingConfirmation {
  id: string;
  toolId: string;
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: RiskLevel;
  summary: string;
  createdAt: number;
}

export interface PermissionSettings {
  fileRead: boolean;
  fileCreate: boolean;
  fileModify: boolean;
  fileDelete: boolean;
  terminalExecute: boolean;
  terminalAdmin: boolean;
  networkAccess: boolean;
  systemReadInfo: boolean;
  systemModifySettings: boolean;
  autoExecuteLowRisk: boolean;
  confirmMediumRisk: boolean;
  confirmHighRisk: boolean;
}
