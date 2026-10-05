import type { ModelPullProgress, OllamaModelSummary, OllamaRunningModel } from "@lacc/shared";
import { logger } from "../logging/Logger.js";
import type {
  OllamaChatChunk,
  OllamaChatRequest,
  OllamaPsResponse,
  OllamaPullProgressChunk,
  OllamaTagsResponse,
} from "./types.js";

export class OllamaUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

async function* readNdjsonStream(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) yield JSON.parse(line);
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer.trim());
  } finally {
    reader.releaseLock();
  }
}

export class OllamaService {
  constructor(private baseUrl: string) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private url(pathSuffix: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}${pathSuffix}`;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(this.url("/api/tags"), { signal: AbortSignal.timeout(2500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async version(): Promise<string | null> {
    try {
      const res = await fetch(this.url("/api/version"), { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return null;
      const data = (await res.json()) as { version?: string };
      return data.version ?? null;
    } catch {
      return null;
    }
  }

  async listModels(): Promise<OllamaModelSummary[]> {
    const res = await fetch(this.url("/api/tags"), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new OllamaUnavailableError(`Failed to list models: HTTP ${res.status}`);
    const data = (await res.json()) as OllamaTagsResponse;
    return data.models.map((m) => ({
      name: m.name,
      model: m.model,
      size: m.size,
      digest: m.digest,
      modifiedAt: m.modified_at,
      parameterSize: m.details?.parameter_size,
      quantizationLevel: m.details?.quantization_level,
      family: m.details?.family,
      capabilities: m.capabilities,
      contextLength: m.context_length,
    }));
  }

  async runningModels(): Promise<OllamaRunningModel[]> {
    const res = await fetch(this.url("/api/ps"), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new OllamaUnavailableError(`Failed to list running models: HTTP ${res.status}`);
    const data = (await res.json()) as OllamaPsResponse;
    return data.models.map((m) => ({
      name: m.name,
      model: m.model,
      sizeVram: m.size_vram,
      digest: m.digest,
      expiresAt: m.expires_at,
    }));
  }

  async showModel(name: string): Promise<Record<string, unknown>> {
    const res = await fetch(this.url("/api/show"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new OllamaUnavailableError(`Failed to show model ${name}: HTTP ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  async deleteModel(name: string): Promise<void> {
    const res = await fetch(this.url("/api/delete"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name }),
    });
    if (!res.ok && res.status !== 404) throw new OllamaUnavailableError(`Failed to delete model ${name}: HTTP ${res.status}`);
  }

  async *pullModel(name: string): AsyncGenerator<ModelPullProgress> {
    const res = await fetch(this.url("/api/pull"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name, stream: true }),
    });
    if (!res.ok || !res.body) {
      yield { model: name, status: "error", done: true, error: `HTTP ${res.status}` };
      return;
    }
    for await (const chunk of readNdjsonStream(res) as AsyncGenerator<OllamaPullProgressChunk>) {
      yield {
        model: name,
        status: chunk.status,
        digest: chunk.digest,
        total: chunk.total,
        completed: chunk.completed,
        done: chunk.status === "success",
        error: chunk.error,
      };
      if (chunk.error) return;
    }
  }

  async *streamChat(request: OllamaChatRequest, abortSignal?: AbortSignal): AsyncGenerator<OllamaChatChunk> {
    let res: Response;
    try {
      res = await fetch(this.url("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, stream: true }),
        signal: abortSignal,
      });
    } catch (err) {
      throw new OllamaUnavailableError("Could not reach Ollama. Is it running?", err);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new OllamaUnavailableError(`Ollama chat request failed: HTTP ${res.status} ${text}`);
    }
    for await (const chunk of readNdjsonStream(res) as AsyncGenerator<OllamaChatChunk>) {
      yield chunk;
    }
  }
}

export function createOllamaService(baseUrl: string): OllamaService {
  logger.info("ollama", `OllamaService targeting ${baseUrl}`);
  return new OllamaService(baseUrl);
}
