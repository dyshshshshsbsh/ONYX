import { describe, it, expect } from "vitest";
import type { ChatMessage } from "@lacc/shared";
import { buildInferenceContext } from "../../src/services/agent/ContextManager.js";

function msg(content: string, createdAt: number): ChatMessage {
  return { id: `m-${createdAt}`, conversationId: "c1", role: "user", content, createdAt };
}

describe("buildInferenceContext", () => {
  it("keeps all history and reports no trimming when it fits comfortably", () => {
    const history = [msg("hi", 1), msg("how are you", 2)];
    const result = buildInferenceContext("system prompt", history, 4096);
    expect(result.trimmed).toBe(false);
    expect(result.droppedMessages).toBe(0);
    // system prompt + both messages
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toEqual({ role: "system", content: "system prompt" });
  });

  it("always keeps at least the most recent message even if it alone exceeds budget", () => {
    const huge = "x".repeat(100_000);
    const history = [msg(huge, 1)];
    const result = buildInferenceContext("sys", history, 256);
    expect(result.messages.some((m) => m.content === huge)).toBe(true);
  });

  it("drops the oldest messages first and keeps the most recent ones", () => {
    // Each message is deliberately much larger than the tiny context budget
    // below, so only the most recent one or two can possibly fit.
    const old1 = "old-1 ".repeat(200);
    const old2 = "old-2 ".repeat(200);
    const recent1 = "recent-1 ".repeat(200);
    const recent2 = "recent-2 ".repeat(200);
    const history = [msg(old1, 1), msg(old2, 2), msg(recent1, 3), msg(recent2, 4)];
    const result = buildInferenceContext("sys", history, 64);
    expect(result.trimmed).toBe(true);
    expect(result.droppedMessages).toBeGreaterThan(0);
    const contents = result.messages.map((m) => m.content);
    expect(contents).toContain(recent2);
    expect(contents).not.toContain(old1);
  });

  it("inserts a synthetic system note explaining the omission when trimming occurs", () => {
    const old1 = "old-1 ".repeat(200);
    const old2 = "old-2 ".repeat(200);
    const recent = "recent ".repeat(200);
    const history = [msg(old1, 1), msg(old2, 2), msg(recent, 3)];
    const result = buildInferenceContext("sys", history, 64);
    const noteMessage = result.messages.find((m) => m.role === "system" && m.content.includes("omitted"));
    expect(noteMessage).toBeDefined();
  });

  it("never inserts an omission note when nothing was dropped", () => {
    const history = [msg("hi", 1)];
    const result = buildInferenceContext("sys", history, 4096);
    const noteMessage = result.messages.find((m) => m.role === "system" && m.content.includes("omitted"));
    expect(noteMessage).toBeUndefined();
  });
});
