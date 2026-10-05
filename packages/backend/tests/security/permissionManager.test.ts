import { describe, it, expect, beforeEach } from "vitest";
import type { AgentSettings, PermissionSettings, ToolDefinition } from "@lacc/shared";
import { PermissionManager } from "../../src/services/security/PermissionManager.js";

function tool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: "read_file",
    name: "Read File",
    description: "",
    category: "filesystem",
    riskLevel: "low",
    timeoutMs: 1000,
    schema: { type: "object", properties: {} },
    ...overrides,
  };
}

const basePermissions: PermissionSettings = {
  fileRead: true,
  fileCreate: true,
  fileModify: true,
  fileDelete: false,
  terminalExecute: true,
  terminalAdmin: false,
  networkAccess: false,
  systemReadInfo: true,
  systemModifySettings: false,
  autoExecuteLowRisk: false,
  confirmMediumRisk: true,
  confirmHighRisk: true,
};

const baseAgentSettings: AgentSettings = {
  toolsEnabled: true,
  automaticToolExecution: false,
  confirmationMode: "risk-based",
  maxIterations: 10,
  toolTimeoutMs: 5000,
};

describe("PermissionManager", () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  it("denies outright when the underlying category permission is off", () => {
    const verdict = manager.evaluate(tool({ id: "write_file", category: "filesystem" }), { ...basePermissions, fileModify: false }, baseAgentSettings);
    expect(verdict).toBe("deny");
  });

  it("requires confirmation for a low-risk tool when auto-execute is disabled", () => {
    const verdict = manager.evaluate(tool({ riskLevel: "low" }), basePermissions, baseAgentSettings);
    expect(verdict).toBe("confirm");
  });

  it("auto-allows a low-risk tool when both automatic execution and the permission are on", () => {
    const verdict = manager.evaluate(
      tool({ riskLevel: "low" }),
      { ...basePermissions, autoExecuteLowRisk: true },
      { ...baseAgentSettings, automaticToolExecution: true }
    );
    expect(verdict).toBe("allow");
  });

  it("confirms high-risk tools when confirmHighRisk is set, regardless of automatic execution", () => {
    const verdict = manager.evaluate(
      tool({ id: "run_command", category: "terminal", riskLevel: "high" }),
      basePermissions,
      { ...baseAgentSettings, automaticToolExecution: true }
    );
    expect(verdict).toBe("confirm");
  });

  it("confirmationMode 'always' forces confirmation even for an allowed low-risk tool", () => {
    const verdict = manager.evaluate(
      tool({ riskLevel: "low" }),
      { ...basePermissions, autoExecuteLowRisk: true },
      { ...baseAgentSettings, automaticToolExecution: true, confirmationMode: "always" }
    );
    expect(verdict).toBe("confirm");
  });

  it("confirmationMode 'never' allows without confirmation as long as the base permission is on", () => {
    const verdict = manager.evaluate(tool({ riskLevel: "high", category: "terminal", id: "run_command" }), basePermissions, {
      ...baseAgentSettings,
      confirmationMode: "never",
    });
    expect(verdict).toBe("allow");
  });

  it("session grants bypass confirmation on subsequent calls for the same tool", () => {
    const t = tool({ riskLevel: "medium", id: "write_file" });
    expect(manager.evaluate(t, basePermissions, baseAgentSettings)).toBe("confirm");
    manager.grantSession(t.id);
    expect(manager.evaluate(t, basePermissions, baseAgentSettings)).toBe("allow");
  });

  it("revokeAllSessionGrants clears previously granted tools", () => {
    const t = tool({ riskLevel: "medium", id: "write_file" });
    manager.grantSession(t.id);
    manager.revokeAllSessionGrants();
    expect(manager.evaluate(t, basePermissions, baseAgentSettings)).toBe("confirm");
  });
});
