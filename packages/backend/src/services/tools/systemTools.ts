import si from "systeminformation";
import { OllamaService } from "../ollama/OllamaService.js";
import { readSystemSnapshot } from "../monitoring/SystemMonitor.js";
import type { RegisteredTool } from "./types.js";

export function createSystemTools(ollama: OllamaService): RegisteredTool[] {
  const getSystemInformationTool: RegisteredTool = {
    definition: {
      id: "get_system_information",
      name: "Get System Information",
      description: "Return real-time CPU, memory, GPU, and Ollama runtime information for this machine.",
      category: "system",
      riskLevel: "low",
      timeoutMs: 8_000,
      schema: { type: "object", properties: {} },
    },
    async handler() {
      return readSystemSnapshot(ollama);
    },
  };

  const getProcessInformationTool: RegisteredTool = {
    definition: {
      id: "get_process_information",
      name: "Get Process Information",
      description: "List the top processes on this machine ranked by CPU usage.",
      category: "system",
      riskLevel: "low",
      timeoutMs: 8_000,
      schema: {
        type: "object",
        properties: { limit: { type: "number", description: "Maximum number of processes to return (default 15)." } },
      },
    },
    async handler(args) {
      const data = await si.processes();
      const limit = typeof args.limit === "number" ? args.limit : 15;
      const top = data.list
        .slice()
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, limit)
        .map((p) => ({ pid: p.pid, name: p.name, cpuPercent: Math.round(p.cpu * 10) / 10, memoryBytes: p.memRss * 1024 }));
      return { total: data.all, processes: top };
    },
  };

  return [getSystemInformationTool, getProcessInformationTool];
}
