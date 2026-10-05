export type LogCategory = "app" | "ollama" | "tool" | "agent" | "system" | "error";
export type LogSeverity = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: number;
  category: LogCategory;
  severity: LogSeverity;
  message: string;
  meta?: Record<string, unknown>;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: number;
  extension?: string;
}
