import { describe, it, expect } from "vitest";
import { ThinkTagSplitter, splitThinkTagsFull } from "../../src/services/aiProvider/ThinkTagSplitter.js";

describe("ThinkTagSplitter (streaming)", () => {
  it("passes plain text through untouched when there are no tags", () => {
    // feed() intentionally withholds a short tail (it might be the start of
    // a tag spanning the next chunk), so the full text only appears once
    // flush() releases that tail at the end of the stream.
    const s = new ThinkTagSplitter();
    const fed = s.feed("hello world");
    const flushed = s.flush();
    expect(fed.content + flushed.content).toBe("hello world");
    expect(fed.thinking + flushed.thinking).toBe("");
  });

  it("routes well-formed <think>...</think> text to thinking and leaves the rest as content", () => {
    const s = new ThinkTagSplitter();
    const a = s.feed("before <think>reasoning</think> after");
    expect(a.content + s.flush().content).toBe("before  after");
  });

  it("handles a tag split across multiple feed() calls", () => {
    const s = new ThinkTagSplitter();
    let content = "";
    let thinking = "";
    for (const chunk of ["before <th", "ink>reas", "oning</th", "ink> after"]) {
      const r = s.feed(chunk);
      content += r.content;
      thinking += r.thinking;
    }
    const flushed = s.flush();
    expect(content + flushed.content).toBe("before  after");
    expect(thinking + flushed.thinking).toBe("reasoning");
  });

  it("does not catch an orphan closing tag with no opening tag (known streaming limitation)", () => {
    // This is exactly the qwen3/Ollama quirk that motivated splitThinkTagsFull:
    // the incremental splitter alone can't retroactively fix text it already emitted.
    const s = new ThinkTagSplitter();
    const r = s.feed("reasoning text</think>answer");
    const flushed = s.flush();
    expect(r.content + flushed.content).toContain("</think>");
  });
});

describe("splitThinkTagsFull (authoritative, non-streaming)", () => {
  it("returns all content when there are no tags", () => {
    expect(splitThinkTagsFull("just an answer")).toEqual({ content: "just an answer", thinking: "" });
  });

  it("splits a well-formed <think>...</think> block", () => {
    expect(splitThinkTagsFull("before <think>reasoning</think>after")).toEqual({
      content: "before after",
      thinking: "reasoning",
    });
  });

  it("treats an orphaned closing tag (no opening tag) as implicit leading reasoning", () => {
    // Reproduces the real qwen3 + think:false response observed from Ollama:
    // the model's template silently starts in reasoning mode with no literal
    // "<think>", but still emits a literal "</think>" before the real answer.
    const result = splitThinkTagsFull("Hmm, let me work through this...</think>hello");
    expect(result.thinking).toBe("Hmm, let me work through this...");
    expect(result.content).toBe("hello");
    expect(result.content).not.toContain("</think>");
  });

  it("handles multiple think blocks in one message", () => {
    const result = splitThinkTagsFull("<think>a</think>mid<think>b</think>end");
    expect(result.content).toBe("midend");
    expect(result.thinking).toBe("ab");
  });

  it("treats an unterminated trailing <think> as thinking with no content", () => {
    const result = splitThinkTagsFull("intro <think>never closes");
    expect(result.content).toBe("intro ");
    expect(result.thinking).toBe("never closes");
  });
});
