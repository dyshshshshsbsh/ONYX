export interface CpuSnapshot {
  utilizationPercent: number;
  logicalCores: number;
  physicalCores: number;
  modelName: string;
  speedGhz: number;
  temperatureC?: number;
}

export interface MemorySnapshot {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  percent: number;
}

export interface GpuSnapshot {
  available: boolean;
  name?: string;
  utilizationPercent?: number;
  vramTotalBytes?: number;
  vramUsedBytes?: number;
  vramPercent?: number;
  temperatureC?: number;
  driverVersion?: string;
  cudaVersion?: string;
  unavailableReason?: string;
}

export interface OllamaRuntimeSnapshot {
  connected: boolean;
  version?: string;
  endpoint: string;
  loadedModel?: string;
  loadedModelSizeBytes?: number;
  contextSize?: number;
  activeRequests: number;
  lastRequestDurationMs?: number;
  lastTokensPerSecond?: number;
  lastTtftMs?: number;
  modelState?: "unknown" | "loading" | "ready" | "idle";
  hardwareWarning?: string;
  unavailableReason?: string;
}

export interface SystemSnapshot {
  timestamp: number;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  gpu: GpuSnapshot;
  ollama: OllamaRuntimeSnapshot;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryBytes: number;
}
