import { db } from "../db.js";

const getStmt = db.prepare("SELECT value FROM kv_store WHERE key = @key");
const setStmt = db.prepare("INSERT INTO kv_store (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = @value");

export function kvGet<T>(key: string): T | null {
  const row = getStmt.get({ key }) as { value: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.value) as T;
}

export function kvSet<T>(key: string, value: T): void {
  setStmt.run({ key, value: JSON.stringify(value) });
}
