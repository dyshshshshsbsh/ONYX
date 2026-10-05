import { createOllamaService } from "./services/ollama/OllamaService.js";
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
export const agentRuntime = new AgentRuntime(aiProvider, toolRegistry);
export const systemMonitor = new SystemMonitor(ollamaService);
