import type { ToolCallRecord } from "@lacc/shared";
import { db } from "../db.js";

interface ToolExecutionRow {
  id: string;
  conversation_id: string;
  tool_id: string;
  args_json: string;
  result_json: string | null;
  error: string | null;
  started_at: number;
  finished_at: number | null;
  risk_level: string;
  approved: number;
}

function rowToRecord(row: ToolExecutionRow): ToolCallRecord {
  return {
    id: row.id,
    toolId: row.tool_id,
    args: JSON.parse(row.args_json),
    result: row.result_json ? JSON.parse(row.result_json) : undefined,
    error: row.error ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    riskLevel: row.risk_level as ToolCallRecord["riskLevel"],
    approved: Boolean(row.approved),
  };
}

export function listToolExecutions(conversationId: string): ToolCallRecord[] {
  const rows = db
    .prepare("SELECT * FROM tool_executions WHERE conversation_id = ? ORDER BY started_at ASC")
    .all(conversationId) as unknown as ToolExecutionRow[];
  return rows.map(rowToRecord);
}

export function insertToolExecution(conversationId: string, record: ToolCallRecord): void {
  db.prepare(
    `INSERT INTO tool_executions (id, conversation_id, tool_id, args_json, result_json, error, started_at, finished_at, risk_level, approved)
     VALUES (@id, @conversationId, @toolId, @argsJson, @resultJson, @error, @startedAt, @finishedAt, @riskLevel, @approved)`
  ).run({
    id: record.id,
    conversationId,
    toolId: record.toolId,
    argsJson: JSON.stringify(record.args),
    resultJson: record.result !== undefined ? JSON.stringify(record.result) : null,
    error: record.error ?? null,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt ?? null,
    riskLevel: record.riskLevel,
    approved: record.approved ? 1 : 0,
  });
}

export function updateToolExecution(record: ToolCallRecord): void {
  db.prepare(
    `UPDATE tool_executions SET result_json = @resultJson, error = @error, finished_at = @finishedAt, approved = @approved WHERE id = @id`
  ).run({
    id: record.id,
    resultJson: record.result !== undefined ? JSON.stringify(record.result) : null,
    error: record.error ?? null,
    finishedAt: record.finishedAt ?? null,
    approved: record.approved ? 1 : 0,
  });
}
