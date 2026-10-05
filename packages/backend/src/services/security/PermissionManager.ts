import type { AgentSettings, PermissionSettings, RiskLevel, ToolCategory, ToolDefinition } from "@lacc/shared";

export type PermissionVerdict = "allow" | "confirm" | "deny";

function categoryPermissionFlag(category: ToolCategory, toolId: string, permissions: PermissionSettings): boolean {
  switch (category) {
    case "filesystem":
      if (toolId === "read_file" || toolId === "list_directory" || toolId === "search_files") return permissions.fileRead;
      if (toolId === "create_file") return permissions.fileCreate;
      if (toolId === "write_file" || toolId === "edit_file" || toolId === "move_file") return permissions.fileModify;
      return permissions.fileRead;
    case "terminal":
      return permissions.terminalExecute;
    case "system":
      return permissions.systemReadInfo;
    case "network":
      return permissions.networkAccess;
    default:
      return false;
  }
}

export class PermissionManager {
  /** toolId -> granted for remainder of the process/session */
  private sessionGrants = new Set<string>();

  grantSession(toolId: string): void {
    this.sessionGrants.add(toolId);
  }

  revokeAllSessionGrants(): void {
    this.sessionGrants.clear();
  }

  hasSessionGrant(toolId: string): boolean {
    return this.sessionGrants.has(toolId);
  }

  evaluate(tool: ToolDefinition, permissions: PermissionSettings, agentSettings: AgentSettings): PermissionVerdict {
    const permitted = categoryPermissionFlag(tool.category, tool.id, permissions);
    if (!permitted) return "deny";
    if (tool.category === "terminal" && tool.id === "run_command" && !permissions.terminalExecute) return "deny";

    if (this.sessionGrants.has(tool.id)) return "allow";

    if (agentSettings.confirmationMode === "never") return "allow";
    if (agentSettings.confirmationMode === "always") return "confirm";

    return this.riskBasedVerdict(tool.riskLevel, permissions, agentSettings);
  }

  private riskBasedVerdict(risk: RiskLevel, permissions: PermissionSettings, agentSettings: AgentSettings): PermissionVerdict {
    if (risk === "low") {
      return agentSettings.automaticToolExecution && permissions.autoExecuteLowRisk ? "allow" : "confirm";
    }
    if (risk === "medium") {
      return permissions.confirmMediumRisk ? "confirm" : "allow";
    }
    return permissions.confirmHighRisk ? "confirm" : "allow";
  }
}

export const permissionManager = new PermissionManager();
