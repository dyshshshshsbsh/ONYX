import { EventEmitter } from "node:events";
import si from "systeminformation";
import type { SystemSnapshot } from "@lacc/shared";
import { OllamaService } from "../ollama/OllamaService.js";
import { readGpuSnapshot } from "./GpuMonitor.js";
import { ollamaRuntimeTracker } from "./OllamaRuntimeTracker.js";
import { logger } from "../logging/Logger.js";

let cachedCpuStatic: { modelName: string; physicalCores: number; logicalCores: number; speedGhz: number } | null = null;

async function getCpuStatic() {
  if (cachedCpuStatic) return cachedCpuStatic;
  const cpu = await si.cpu();
  cachedCpuStatic = {
    modelName: [cpu.manufacturer, cpu.brand].filter(Boolean).join(" ").trim() || "Unknown CPU",
    physicalCores: cpu.physicalCores || cpu.cores || 1,
    logicalCores: cpu.cores || 1,
    speedGhz: cpu.speed || 0,
  };
  return cachedCpuStatic;
}

export async function readSystemSnapshot(ollama: OllamaService): Promise<SystemSnapshot> {
  const [load, mem, cpuStatic, temp, gpu, connected] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    getCpuStatic(),
    si.cpuTemperature().catch(() => ({ main: null as number | null })),
    readGpuSnapshot(),
    ollama.health(),
  ]);

  let loadedModel: string | undefined;
  let loadedModelSizeBytes: number | undefined;
  let version: string | undefined;
  if (connected) {
    try {
      const [running, ver] = await Promise.all([ollama.runningModels(), ollama.version()]);
      loadedModel = running[0]?.name;
      loadedModelSizeBytes = running[0]?.sizeVram;
      version = ver ?? undefined;
    } catch (err) {
      logger.debug("ollama", "Failed to read running models", { error: String(err) });
    }
  }

  const snapshot: SystemSnapshot = {
    timestamp: Date.now(),
    cpu: {
      utilizationPercent: Math.round(load.currentLoad * 10) / 10,
      logicalCores: cpuStatic.logicalCores,
      physicalCores: cpuStatic.physicalCores,
      modelName: cpuStatic.modelName,
      speedGhz: cpuStatic.speedGhz,
      temperatureC: typeof temp.main === "number" && temp.main > 0 ? temp.main : undefined,
    },
    memory: {
      totalBytes: mem.total,
      usedBytes: mem.active,
      freeBytes: mem.available,
      percent: Math.round((mem.active / mem.total) * 1000) / 10,
    },
    gpu,
    ollama: {
      connected,
      version,
      endpoint: ollama.getBaseUrl(),
      loadedModel,
      loadedModelSizeBytes,
      activeRequests: ollamaRuntimeTracker.getActiveRequests(),
      lastRequestDurationMs: ollamaRuntimeTracker.getLastRequestDurationMs(),
      lastTokensPerSecond: ollamaRuntimeTracker.getLastTokensPerSecond(),
      unavailableReason: connected ? undefined : "Ollama is offline. Start Ollama and try again.",
    },
  };

  return snapshot;
}

export class SystemMonitor extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;

  constructor(private ollama: OllamaService) {
    super();
  }

  start(intervalMs: number): void {
    this.stop();
    this.timer = setInterval(() => {
      readSystemSnapshot(this.ollama)
        .then((snapshot) => this.emit("snapshot", snapshot))
        .catch((err) => logger.error("system", "Failed to read system snapshot", { error: String(err) }));
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
