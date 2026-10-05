import type {
  AppSettings,
  Conversation,
  ChatMessage,
  FileEntry,
  LogEntry,
  OllamaModelSummary,
  OllamaRunningModel,
  ProcessInfo,
  SystemSnapshot,
  SystemPromptProfile,
  ToolCallRecord,
  ToolDefinition,
} from "@lacc/shared";

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error ?? `Request failed: ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  models: {
    list: () => request<{ models: OllamaModelSummary[] }>("/models"),
    running: () => request<{ models: OllamaRunningModel[] }>("/models/running"),
    show: (name: string) => request<Record<string, unknown>>(`/models/${encodeURIComponent(name)}/show`),
    pull: (name: string) => request<{ started: boolean }>("/models/pull", { method: "POST", body: JSON.stringify({ name }) }),
    remove: (name: string) => request<{ removed: boolean }>(`/models/${encodeURIComponent(name)}`, { method: "DELETE" }),
  },

  conversations: {
    list: (archived = false) => request<{ conversations: Conversation[] }>(`/conversations?archived=${archived}`),
    create: (payload: { title?: string; model?: string; systemPromptProfileId?: string | null }) =>
      request<{ conversation: Conversation }>("/conversations", { method: "POST", body: JSON.stringify(payload) }),
    get: (id: string) => request<{ conversation: Conversation }>(`/conversations/${id}`),
    messages: (id: string) => request<{ messages: ChatMessage[] }>(`/conversations/${id}/messages`),
    toolExecutions: (id: string) => request<{ toolExecutions: ToolCallRecord[] }>(`/conversations/${id}/tool-executions`),
    update: (id: string, payload: { title?: string; archived?: boolean; systemPromptProfileId?: string | null; model?: string }) =>
      request<{ conversation: Conversation }>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (id: string) => request<{ deleted: boolean }>(`/conversations/${id}`, { method: "DELETE" }),
  },

  promptProfiles: {
    list: () => request<{ profiles: SystemPromptProfile[] }>("/prompt-profiles"),
    create: (name: string, content: string) =>
      request<{ profile: SystemPromptProfile }>("/prompt-profiles", { method: "POST", body: JSON.stringify({ name, content }) }),
    update: (id: string, payload: { name?: string; content?: string }) =>
      request<{ profile: SystemPromptProfile }>(`/prompt-profiles/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    duplicate: (id: string) => request<{ profile: SystemPromptProfile }>(`/prompt-profiles/${id}/duplicate`, { method: "POST" }),
    remove: (id: string) => request<{ deleted: boolean }>(`/prompt-profiles/${id}`, { method: "DELETE" }),
  },

  settings: {
    get: () => request<{ settings: AppSettings }>("/settings"),
    update: (partial: Partial<AppSettings>) =>
      request<{ settings: AppSettings }>("/settings", { method: "PATCH", body: JSON.stringify(partial) }),
    reset: () => request<{ settings: AppSettings }>("/settings/reset", { method: "POST" }),
  },

  tools: {
    list: () => request<{ tools: (ToolDefinition & { verdict: string; sessionGranted: boolean })[] }>("/tools"),
  },

  fs: {
    workspaces: () => request<{ roots: string[] }>("/fs/workspaces"),
    list: (path: string) => request<{ path: string; entries: FileEntry[] }>(`/fs/list?path=${encodeURIComponent(path)}`),
    read: (path: string) =>
      request<{ path: string; content: string; truncated: boolean; sizeBytes: number; modifiedAt: number }>(
        `/fs/read?path=${encodeURIComponent(path)}`
      ),
    write: (path: string, content: string) => request<{ saved: boolean }>("/fs/write", { method: "POST", body: JSON.stringify({ path, content }) }),
    create: (path: string, content?: string, isDirectory?: boolean) =>
      request<{ created: boolean }>("/fs/create", { method: "POST", body: JSON.stringify({ path, content, isDirectory }) }),
    move: (source: string, destination: string) =>
      request<{ moved: boolean }>("/fs/move", { method: "POST", body: JSON.stringify({ source, destination }) }),
    remove: (path: string) => request<{ deleted: boolean }>(`/fs/delete?path=${encodeURIComponent(path)}`, { method: "DELETE" }),
  },

  system: {
    snapshot: () => request<{ snapshot: SystemSnapshot }>("/system/snapshot"),
    processes: (limit = 15) => request<{ total: number; processes: ProcessInfo[] }>(`/system/processes?limit=${limit}`),
  },

  logs: {
    list: (params: { limit?: number; category?: string; severity?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.category) qs.set("category", params.category);
      if (params.severity) qs.set("severity", params.severity);
      return request<{ logs: LogEntry[] }>(`/logs?${qs.toString()}`);
    },
    clear: () => request<{ cleared: boolean }>("/logs", { method: "DELETE" }),
  },

  diagnostics: {
    get: () => request<Record<string, unknown>>("/diagnostics"),
  },
};

export { ApiError };
