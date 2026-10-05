import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadGpuSnapshot = vi.fn();
vi.mock("../../src/services/monitoring/GpuMonitor.js", () => ({
  readGpuSnapshot: () => mockReadGpuSnapshot(),
}));

describe("getInferenceProfiles", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadGpuSnapshot.mockReset();
  });

  it("uses conservative context sizes for a 4GB card (this app's reference hardware)", async () => {
    mockReadGpuSnapshot.mockResolvedValue({ available: true, vramTotalBytes: 4 * 1024 ** 3 });
    const { getInferenceProfiles } = await import("../../src/services/aiProvider/InferenceProfiles.js");
    const profiles = await getInferenceProfiles();
    expect(profiles.fast.numCtx).toBeLessThanOrEqual(4096);
    expect(profiles.balanced.numCtx).toBeLessThanOrEqual(8192);
    expect(profiles.fast.numCtx).toBeLessThan(profiles.balanced.numCtx);
    expect(profiles.balanced.numCtx).toBeLessThan(profiles.deep.numCtx);
  });

  it("scales context up for a GPU with much more VRAM", async () => {
    mockReadGpuSnapshot.mockResolvedValue({ available: true, vramTotalBytes: 24 * 1024 ** 3 });
    const { getInferenceProfiles } = await import("../../src/services/aiProvider/InferenceProfiles.js");
    const profiles = await getInferenceProfiles();
    expect(profiles.balanced.numCtx).toBeGreaterThan(8000);
  });

  it("falls back to conservative defaults when no GPU is available", async () => {
    mockReadGpuSnapshot.mockResolvedValue({ available: false });
    const { getInferenceProfiles } = await import("../../src/services/aiProvider/InferenceProfiles.js");
    const profiles = await getInferenceProfiles();
    expect(profiles.fast.numCtx).toBe(2048);
  });

  it("fast profile disables thinking and deep profile enables it", async () => {
    mockReadGpuSnapshot.mockResolvedValue({ available: false });
    const { getInferenceProfiles } = await import("../../src/services/aiProvider/InferenceProfiles.js");
    const profiles = await getInferenceProfiles();
    expect(profiles.fast.think).toBe(false);
    expect(profiles.deep.think).toBe(true);
  });

  it("every profile sets a finite num_predict so generation cannot run unbounded", async () => {
    mockReadGpuSnapshot.mockResolvedValue({ available: false });
    const { getInferenceProfiles } = await import("../../src/services/aiProvider/InferenceProfiles.js");
    const profiles = await getInferenceProfiles();
    for (const profile of Object.values(profiles)) {
      expect(profile.numPredict).toBeGreaterThan(0);
      expect(Number.isFinite(profile.numPredict)).toBe(true);
    }
  });
});
