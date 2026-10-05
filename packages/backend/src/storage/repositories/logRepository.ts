import type { LogEntry } from "@lacc/shared";
import { db } from "../db.js";
import type { LogSink } from "../../services/logging/Logger.js";

interface LogRow {
  id: string;
  timestamp: number;
  category: string;
  severity: string;
  message: string;
  meta_json: string | null;
}

function rowToEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    category: row.category as LogEntry["category"],
    severity: row.severity as LogEntry["severity"],
    message: row.message,
    meta: row.meta_json ? JSON.parse(row.meta_json) : undefined,
  };
}

const insertStmt = db.prepare(
  "INSERT INTO logs (id, timestamp, category, severity, message, meta_json) VALUES (@id, @timestamp, @category, @severity, @message, @metaJson)"
);

export const sqliteLogSink: LogSink = {
  insert(entry: LogEntry) {
    insertStmt.run({
      id: entry.id,
      timestamp: entry.timestamp,
      category: entry.category,
      severity: entry.severity,
      message: entry.message,
      metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
    });
  },
  clear() {
    db.prepare("DELETE FROM logs").run();
  },
};

export interface LogQuery {
  limit?: number;
  category?: string;
  severity?: string;
}

export function listLogs(query: LogQuery = {}): LogEntry[] {
  const limit = query.limit ?? 200;
  const clauses: string[] = [];
  const params: Record<string, unknown> = { limit };
  if (query.category) {
    clauses.push("category = @category");
    params.category = query.category;
  }
  if (query.severity) {
    clauses.push("severity = @severity");
    params.severity = query.severity;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM logs ${where} ORDER BY timestamp DESC LIMIT @limit`)
    .all(params as Record<string, string | number>) as unknown as LogRow[];
  return rows.map(rowToEntry);
}
