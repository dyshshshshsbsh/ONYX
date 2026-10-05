import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { dbPath, ensureDataDir } from "../config/paths.js";

ensureDataDir();

// Node's built-in SQLite binding — in-process with the exact Node/V8 ABI
// running the app, so there is no prebuilt native addon to go stale or
// crash on a new Node version (unlike third-party addons such as
// better-sqlite3, which carry that risk).
//
// Loaded via createRequire rather than a static `import` because vite-node
// (the module runner vitest uses) mis-resolves the "node:sqlite" specifier
// as bare "sqlite" while rewriting builtins, which only exists under the
// "node:" scheme. createRequire's require() is opaque to that transform, so
// it reaches Node's real module loader unchanged. Production (tsx / node
// dist/index.js) is unaffected either way.
const require = createRequire(import.meta.url);
const { DatabaseSync }: { DatabaseSync: typeof DatabaseSyncType } = require("node:sqlite");

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt_profile_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  thinking TEXT,
  tool_calls_json TEXT,
  created_at INTEGER NOT NULL,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER,
  tokens_per_second REAL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS system_prompt_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  built_in INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  args_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  risk_level TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tool_exec_conversation ON tool_executions(conversation_id, started_at);
`;

db.exec(SCHEMA);
