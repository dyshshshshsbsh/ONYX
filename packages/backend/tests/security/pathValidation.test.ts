import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { resolveWorkspacePath, isWithinWorkspace, PathAccessDeniedError } from "../../src/services/security/pathValidation.js";

const root = path.join(os.tmpdir(), "lacc-test-workspace");

describe("resolveWorkspacePath", () => {
  it("resolves a relative path inside the workspace root", () => {
    const resolved = resolveWorkspacePath([root], "subdir/file.txt");
    expect(resolved).toBe(path.resolve(root, "subdir/file.txt"));
  });

  it("resolves the root itself", () => {
    expect(resolveWorkspacePath([root], ".")).toBe(path.resolve(root));
  });

  it("accepts an absolute path that is inside the workspace", () => {
    const inside = path.join(root, "nested", "file.txt");
    expect(resolveWorkspacePath([root], inside)).toBe(path.resolve(inside));
  });

  it("rejects a relative traversal that escapes the workspace", () => {
    expect(() => resolveWorkspacePath([root], "../../outside.txt")).toThrow(PathAccessDeniedError);
  });

  it("rejects an absolute path outside every configured root", () => {
    const outside = path.join(os.tmpdir(), "totally-different-place", "file.txt");
    expect(() => resolveWorkspacePath([root], outside)).toThrow(PathAccessDeniedError);
  });

  it("rejects a sibling directory whose name merely starts with the root's name", () => {
    // e.g. root "C:\...\lacc-test-workspace" must not accept "C:\...\lacc-test-workspace-evil"
    const sneaky = `${root}-evil`;
    expect(() => resolveWorkspacePath([root], sneaky)).toThrow(PathAccessDeniedError);
  });

  it("accepts a path inside any of several configured roots", () => {
    const secondRoot = path.join(os.tmpdir(), "lacc-test-workspace-2");
    const resolved = resolveWorkspacePath([root, secondRoot], path.join(secondRoot, "a.txt"));
    expect(resolved).toBe(path.resolve(secondRoot, "a.txt"));
  });

  it("isWithinWorkspace mirrors resolveWorkspacePath without throwing", () => {
    expect(isWithinWorkspace([root], "ok.txt")).toBe(true);
    expect(isWithinWorkspace([root], "../escape.txt")).toBe(false);
  });
});
