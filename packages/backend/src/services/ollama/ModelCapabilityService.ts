import type { OllamaService } from "./OllamaService.js";

interface CacheEntry {
  capabilities: Set<string>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;

/**
 * Caches /api/tags capability data per model so we never send a "think"
 * parameter to a model that doesn't support it, without re-fetching the
 * model list on every single chat turn.
 */
export class ModelCapabilityService {
  private cache = new Map<string, CacheEntry>();
  private listFetchedAt = 0;

  constructor(private ollama: OllamaService) {}

  private async ensureFresh(): Promise<void> {
    const now = Date.now();
    if (now - this.listFetchedAt < CACHE_TTL_MS && this.cache.size > 0) return;
    try {
      const models = await this.ollama.listModels();
      this.cache.clear();
      for (const model of models) {
        this.cache.set(model.name, { capabilities: new Set(model.capabilities ?? []), fetchedAt: now });
      }
      this.listFetchedAt = now;
    } catch {
      // Keep whatever we had cached; callers fall back to safe defaults below.
    }
  }

  async supportsThinking(modelName: string): Promise<boolean> {
    await this.ensureFresh();
    return this.cache.get(modelName)?.capabilities.has("thinking") ?? false;
  }

  async supportsTools(modelName: string): Promise<boolean> {
    await this.ensureFresh();
    return this.cache.get(modelName)?.capabilities.has("tools") ?? true; // assume yes if unknown; the model will just ignore tool specs it can't use
  }
}
