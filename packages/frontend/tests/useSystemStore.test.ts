import { describe, it, expect, beforeEach } from "vitest";
import { useSystemStore } from "../src/stores/useSystemStore";
import type { SystemSnapshot } from "@lacc/shared";

function snapshot(overrides: Partial<SystemSnapshot> = {}): SystemSnapshot {
  return {
    timestamp: Date.now(),
    cpu: { utilizationPercent: 50, logicalCores: 8, physicalCores: 4, modelName: "Test CPU", speedGhz: 3 },
    memory: { totalBytes: 100, usedBytes: 50, freeBytes: 50, percent: 50 },
    gpu: { available: false, unavailableReason: "no gpu" },
    ollama: { connected: true, endpoint: "http://localhost:11434", activeRequests: 0 },
    ...overrides,
  };
}

describe("useSystemStore", () => {
  beforeEach(() => {
    useSystemStore.setState({ snapshot: null, cpuHistory: [], memHistory: [], gpuUtilHistory: [], gpuVramHistory: [], wsConnected: false });
  });

  it("applySnapshot sets the current snapshot and appends to cpu/memory history", () => {
    useSystemStore.getState().applySnapshot(snapshot({ cpu: { utilizationPercent: 77, logicalCores: 8, physicalCores: 4, modelName: "x", speedGhz: 1 } }));
    const state = useSystemStore.getState();
    expect(state.snapshot?.cpu.utilizationPercent).toBe(77);
    expect(state.cpuHistory).toHaveLength(1);
    expect(state.cpuHistory[0].v).toBe(77);
  });

  it("does not append GPU history points when the GPU is unavailable", () => {
    useSystemStore.getState().applySnapshot(snapshot());
    expect(useSystemStore.getState().gpuUtilHistory).toHaveLength(0);
  });

  it("appends GPU history points when the GPU is available", () => {
    useSystemStore.getState().applySnapshot(snapshot({ gpu: { available: true, utilizationPercent: 42, vramPercent: 10 } }));
    const state = useSystemStore.getState();
    expect(state.gpuUtilHistory).toHaveLength(1);
    expect(state.gpuUtilHistory[0].v).toBe(42);
    expect(state.gpuVramHistory[0].v).toBe(10);
  });

  it("caps history length at 300 points by dropping the oldest", () => {
    for (let i = 0; i < 305; i++) {
      useSystemStore.getState().applySnapshot(snapshot({ timestamp: i, cpu: { utilizationPercent: i, logicalCores: 8, physicalCores: 4, modelName: "x", speedGhz: 1 } }));
    }
    const history = useSystemStore.getState().cpuHistory;
    expect(history).toHaveLength(300);
    // the oldest 5 points (values 0-4) should have been dropped
    expect(history[0].v).toBe(5);
    expect(history[history.length - 1].v).toBe(304);
  });

  it("setConnected updates wsConnected", () => {
    useSystemStore.getState().setConnected(true);
    expect(useSystemStore.getState().wsConnected).toBe(true);
  });
});
