import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { LogCategory, LogEntry, LogLevel, LogSeverity } from "@lacc/shared";

const SEVERITY_RANK: Record<LogSeverity, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_THRESHOLD: Record<LogLevel, number> = {
  disabled: Infinity,
  errors: SEVERITY_RANK.error,
  standard: SEVERITY_RANK.info,
  debug: SEVERITY_RANK.debug,
};

export interface LogSink {
  insert(entry: LogEntry): void;
  clear(): void;
}

class Logger extends EventEmitter {
  private level: LogLevel = "standard";
  private sink: LogSink | null = null;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  attachSink(sink: LogSink): void {
    this.sink = sink;
  }

  clear(): void {
    this.sink?.clear();
  }

  private write(category: LogCategory, severity: LogSeverity, message: string, meta?: Record<string, unknown>): void {
    if (SEVERITY_RANK[severity] < LEVEL_THRESHOLD[this.level]) return;
    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      category,
      severity,
      message,
      meta,
    };
    this.sink?.insert(entry);
    this.emit("entry", entry);
    const consoleFn = severity === "error" ? console.error : severity === "warn" ? console.warn : console.log;
    consoleFn(`[${category}] ${message}`, meta ?? "");
  }

  debug(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.write(category, "debug", message, meta);
  }

  info(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.write(category, "info", message, meta);
  }

  warn(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.write(category, "warn", message, meta);
  }

  error(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
    this.write(category, "error", message, meta);
  }
}

export const logger = new Logger();
