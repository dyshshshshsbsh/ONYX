import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ToolRegistry } from "../../src/services/tools/registry.js";
import { OllamaService } from "../../src/services/ollama/OllamaService.js";
import { PathAccessDeniedError } from "../../src/services/security/pathValidation.js";

let workspace: string;
let registry: ToolRegistry;

beforeAll(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "lacc-registry-test-"));
  await fs.writeFile(path.join(workspace, "hello.txt"), "hello world", "utf-8");
  await fs.mkdir(path.join(workspace, "sub"));
  registry = new ToolRegistry(new OllamaService("http://127.0.0.1:1"));
});

afterAll(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

function context(overrides: Partial<Parameters<ToolRegistry["execute"]>[2]> = {}) {
  return {
    workspaceRoots: [workspace],
    conversationId: "test-conversation",
    // Generous: get_system_information queries CPU/GPU and can be slow on
    // contended or modest hardware.
    toolTimeoutMs: 20000,
    blockedCommandPatterns: [] as string[],
    ...overrides,
  };
}

describe("ToolRegistry", () => {
  it("registers all expected built-in tools", () => {
    const ids = registry.list().map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "list_directory",
        "read_file",
        "search_files",
        "create_file",
        "write_file",
        "edit_file",
        "move_file",
        "run_command",
        "get_system_information",
        "get_process_information",
      ])
    );
  });

  it("list_directory returns real entries for the workspace", async () => {
    const result = (await registry.execute("list_directory", { path: "." }, context())) as { entries: Array<{ name: string }> };
    const names = result.entries.map((e) => e.name);
    expect(names).toContain("hello.txt");
    expect(names).toContain("sub");
  });

  it("read_file returns the real file contents", async () => {
    const result = (await registry.execute("read_file", { path: "hello.txt" }, context())) as { content: string };
    expect(result.content).toBe("hello world");
  });

  it("write_file then read_file round-trips new content", async () => {
    await registry.execute("write_file", { path: "written.txt", content: "round trip" }, context());
    const result = (await registry.execute("read_file", { path: "written.txt" }, context())) as { content: string };
    expect(result.content).toBe("round trip");
  });

  it("create_file refuses to overwrite an existing file", async () => {
    await expect(registry.execute("create_file", { path: "hello.txt", content: "x" }, context())).rejects.toThrow(/already exists/);
  });

  it("edit_file requires a unique match and rejects an absent search string", async () => {
    await expect(registry.execute("edit_file", { path: "hello.txt", search: "nope-not-there", replace: "x" }, context())).rejects.toThrow(
      /not found/
    );
  });

  it("refuses to read a path outside the workspace root", async () => {
    await expect(registry.execute("read_file", { path: path.join(os.tmpdir(), "outside.txt") }, context())).rejects.toThrow(
      PathAccessDeniedError
    );
  });

  it("run_command executes a real process and captures stdout and exit code", async () => {
    const isWindows = process.platform === "win32";
    const command = isWindows ? "cmd /c echo hello-from-test" : "echo hello-from-test";
    const result = (await registry.execute("run_command", { command }, context())) as { stdout: string; exitCode: number };
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello-from-test");
  });

  it("run_command is rejected when the command matches a blocked pattern", async () => {
    await expect(
      registry.execute("run_command", { command: "shutdown /s" }, context({ blockedCommandPatterns: ["shutdown"] }))
    ).rejects.toThrow(/blocked/i);
  });

  it("get_system_information returns a real, structured snapshot", async () => {
    const result = (await registry.execute("get_system_information", {}, context())) as any;
    expect(result.cpu.logicalCores).toBeGreaterThan(0);
    expect(typeof result.memory.totalBytes).toBe("number");
  });

  it("an unknown tool id is rejected", async () => {
    await expect(registry.execute("not_a_real_tool", {}, context())).rejects.toThrow(/Unknown tool/);
  });
});
