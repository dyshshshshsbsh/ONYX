import { create } from "zustand";
import type { SystemSnapshot } from "@lacc/shared";

export interface HistoryPoint {
  t: number;
  v: number;
}

const MAX_POINTS = 300;

interface SystemState {
  snapshot: SystemSnapshot | null;
  wsConnected: boolean;
  cpuHistory: HistoryPoint[];
  memHistory: HistoryPoint[];
  gpuUtilHistory: HistoryPoint[];
  gpuVramHistory: HistoryPoint[];
  setConnected: (connected: boolean) => void;
  applySnapshot: (snapshot: SystemSnapshot) => void;
}

function push(history: HistoryPoint[], point: HistoryPoint): HistoryPoint[] {
  const next = [...history, point];
  if (next.length > MAX_POINTS) next.shift();
  return next;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  snapshot: null,
  wsConnected: false,
  cpuHistory: [],
  memHistory: [],
  gpuUtilHistory: [],
  gpuVramHistory: [],
  setConnected: (connected) => set({ wsConnected: connected }),
  applySnapshot: (snapshot) => {
    const t = snapshot.timestamp;
    set({
      snapshot,
      cpuHistory: push(get().cpuHistory, { t, v: snapshot.cpu.utilizationPercent }),
      memHistory: push(get().memHistory, { t, v: snapshot.memory.percent }),
      gpuUtilHistory: snapshot.gpu.available ? push(get().gpuUtilHistory, { t, v: snapshot.gpu.utilizationPercent ?? 0 }) : get().gpuUtilHistory,
      gpuVramHistory: snapshot.gpu.available ? push(get().gpuVramHistory, { t, v: snapshot.gpu.vramPercent ?? 0 }) : get().gpuVramHistory,
    });
  },
}));
