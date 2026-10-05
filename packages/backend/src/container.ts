import { createOllamaService } from "./services/ollama/OllamaService.js";
import { ModelCapabilityService } from "./services/ollama/ModelCapabilityService.js";
import { OllamaProvider } from "./services/aiProvider/OllamaProvider.js";
import { ToolRegistry } from "./services/tools/registry.js";
import { AgentRuntime } from "./services/agent/AgentRuntime.js";
import { SystemMonitor } from "./services/monitoring/SystemMonitor.js";
import { getSettings } from "./storage/repositories/settingsRepository.js";
import { logger } from "./services/logging/Logger.js";
import { sqliteLogSink } from "./storage/repositories/logRepository.js";
import { seedBuiltInProfiles } from "./storage/repositories/promptProfileRepository.js";

seedBuiltInProfiles();

const settings = getSettings();
logger.setLevel(settings.logLevel);
logger.attachSink(sqliteLogSink);

export const ollamaService = createOllamaService(settings.ollama.endpoint);
export const aiProvider = new OllamaProvider(ollamaService);
export const toolRegistry = new ToolRegistry(ollamaService);
export const modelCapabilityService = new ModelCapabilityService(ollamaService);
export const agentRuntime = new AgentRuntime(aiProvider, toolRegistry, modelCapabilityService);
export const systemMonitor = new SystemMonitor(ollamaService);

if (settings.ollama.warmOnStartup) {
  const keepAlive = `${Math.max(1, settings.ollama.keepAliveMinutes)}m`;
  ollamaService
    .warmModel(settings.ai.defaultModel, keepAlive)
    .then(() => logger.info("ollama", `Warmed up ${settings.ai.defaultModel} on startup.`))
    .catch((err) => logger.warn("ollama", `Startup warm-up skipped: ${String(err?.message ?? err)}`));
}
