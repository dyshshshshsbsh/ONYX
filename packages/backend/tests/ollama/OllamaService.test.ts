import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaService, OllamaUnavailableError } from "../../src/services/ollama/OllamaService.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function ndjsonResponse(lines: unknown[]): Response {
  const encoder = new TextEncoder();
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  const bytes = encoder.encode(body);
  let sent = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: bytes };
          },
          releaseLock() {},
        };
      },
    },
  } as unknown as Response;
}

describe("OllamaService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("health() returns true when the server responds ok", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const service = new OllamaService("http://localhost:11434");
    await expect(service.health()).resolves.toBe(true);
  });

  it("health() returns false when the request throws (server unreachable)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const service = new OllamaService("http://localhost:11434");
    await expect(service.health()).resolves.toBe(false);
  });

  it("listModels() maps the Ollama tags response into our shared model shape", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          {
            name: "qwen3:4b",
            model: "qwen3:4b",
            size: 123,
            digest: "abc",
            modified_at: "2026-01-01T00:00:00Z",
            details: { parameter_size: "4.0B", quantization_level: "Q4_K_M" },
            capabilities: ["tools"],
          },
        ],
      })
    );
    const service = new OllamaService("http://localhost:11434");
    const models = await service.listModels();
    expect(models).toEqual([
      expect.objectContaining({ name: "qwen3:4b", parameterSize: "4.0B", quantizationLevel: "Q4_K_M", capabilities: ["tools"] }),
    ]);
  });

  it("listModels() throws OllamaUnavailableError on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 500));
    const service = new OllamaService("http://localhost:11434");
    await expect(service.listModels()).rejects.toBeInstanceOf(OllamaUnavailableError);
  });

  it("streamChat() parses newline-delimited JSON chunks in order", async () => {
    fetchMock.mockResolvedValueOnce(
      ndjsonResponse([
        { model: "qwen3:4b", created_at: "t", message: { role: "assistant", content: "Hel" }, done: false },
        { model: "qwen3:4b", created_at: "t", message: { role: "assistant", content: "lo" }, done: false },
        { model: "qwen3:4b", created_at: "t", message: { role: "assistant", content: "" }, done: true, eval_count: 2, eval_duration: 1_000_000_000 },
      ])
    );
    const service = new OllamaService("http://localhost:11434");
    const chunks = [];
    for await (const chunk of service.streamChat({ model: "qwen3:4b", messages: [{ role: "user", content: "hi" }] })) {
      chunks.push(chunk);
    }
    expect(chunks.map((c) => c.message.content)).toEqual(["Hel", "lo", ""]);
    expect(chunks[2].done).toBe(true);
    expect(chunks[2].eval_count).toBe(2);
  });

  it("streamChat() wraps a network failure as OllamaUnavailableError", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const service = new OllamaService("http://localhost:11434");
    const iterate = async () => {
      for await (const _ of service.streamChat({ model: "qwen3:4b", messages: [] })) {
        /* noop */
      }
    };
    await expect(iterate()).rejects.toBeInstanceOf(OllamaUnavailableError);
  });
});
