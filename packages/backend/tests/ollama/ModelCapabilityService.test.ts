import { describe, it, expect, vi } from "vitest";
import { ModelCapabilityService } from "../../src/services/ollama/ModelCapabilityService.js";
import type { OllamaService } from "../../src/services/ollama/OllamaService.js";

function fakeOllama(models: Array<{ name: string; capabilities?: string[] }>) {
  return {
    listModels: vi.fn().mockResolvedValue(
      models.map((m) => ({ name: m.name, model: m.name, size: 0, digest: "", modifiedAt: "", capabilities: m.capabilities }))
    ),
  } as unknown as OllamaService;
}

describe("ModelCapabilityService", () => {
  it("reports thinking support when the model advertises the 'thinking' capability", async () => {
    const service = new ModelCapabilityService(fakeOllama([{ name: "qwen3:4b", capabilities: ["completion", "tools", "thinking"] }]));
    expect(await service.supportsThinking("qwen3:4b")).toBe(true);
  });

  it("reports no thinking support when the model doesn't advertise it", async () => {
    const service = new ModelCapabilityService(fakeOllama([{ name: "llama3.2:3b", capabilities: ["completion"] }]));
    expect(await service.supportsThinking("llama3.2:3b")).toBe(false);
  });

  it("defaults to no thinking support for an unknown model rather than guessing yes", async () => {
    const service = new ModelCapabilityService(fakeOllama([{ name: "qwen3:4b", capabilities: ["thinking"] }]));
    expect(await service.supportsThinking("some-other-model")).toBe(false);
  });

  it("caches the model list instead of refetching on every call", async () => {
    const ollama = fakeOllama([{ name: "qwen3:4b", capabilities: ["thinking"] }]);
    const service = new ModelCapabilityService(ollama);
    await service.supportsThinking("qwen3:4b");
    await service.supportsThinking("qwen3:4b");
    await service.supportsTools("qwen3:4b");
    expect((ollama.listModels as any).mock.calls.length).toBe(1);
  });
});
