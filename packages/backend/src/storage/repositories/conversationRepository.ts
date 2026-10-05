import { randomUUID } from "node:crypto";
import type { ChatMessage, Conversation } from "@lacc/shared";
import { db } from "../db.js";

interface ConversationRow {
  id: string;
  title: string;
  model: string;
  system_prompt_profile_id: string | null;
  created_at: number;
  updated_at: number;
  archived: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  thinking: string | null;
  tool_calls_json: string | null;
  created_at: number;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  tokens_per_second: number | null;
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    systemPromptProfileId: row.system_prompt_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: Boolean(row.archived),
  };
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    thinking: row.thinking ?? undefined,
    toolCalls: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : undefined,
    createdAt: row.created_at,
    model: row.model ?? undefined,
    promptTokens: row.prompt_tokens ?? undefined,
    completionTokens: row.completion_tokens ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    tokensPerSecond: row.tokens_per_second ?? undefined,
  };
}

export function createConversation(title: string, model: string, systemPromptProfileId: string | null): Conversation {
  const now = Date.now();
  const conv: Conversation = { id: randomUUID(), title, model, systemPromptProfileId, createdAt: now, updatedAt: now, archived: false };
  db.prepare(
    "INSERT INTO conversations (id, title, model, system_prompt_profile_id, created_at, updated_at, archived) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).run(conv.id, conv.title, conv.model, conv.systemPromptProfileId, conv.createdAt, conv.updatedAt);
  return conv;
}

export function listConversations(includeArchived = false): Conversation[] {
  const rows = includeArchived
    ? (db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all() as unknown as ConversationRow[])
    : (db.prepare("SELECT * FROM conversations WHERE archived = 0 ORDER BY updated_at DESC").all() as unknown as ConversationRow[]);
  return rows.map(rowToConversation);
}

export function getConversation(id: string): Conversation | null {
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConversationRow | undefined;
  return row ? rowToConversation(row) : null;
}

export function touchConversation(id: string): void {
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(Date.now(), id);
}

export function renameConversation(id: string, title: string): void {
  db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(title, Date.now(), id);
}

export function setConversationSystemPromptProfile(id: string, systemPromptProfileId: string | null): void {
  db.prepare("UPDATE conversations SET system_prompt_profile_id = ?, updated_at = ? WHERE id = ?").run(systemPromptProfileId, Date.now(), id);
}

export function setConversationModel(id: string, model: string): void {
  db.prepare("UPDATE conversations SET model = ?, updated_at = ? WHERE id = ?").run(model, Date.now(), id);
}

export function setConversationArchived(id: string, archived: boolean): void {
  db.prepare("UPDATE conversations SET archived = ? WHERE id = ?").run(archived ? 1 : 0, id);
}

export function deleteConversation(id: string): void {
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

export function insertMessage(message: ChatMessage): void {
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, thinking, tool_calls_json, created_at, model, prompt_tokens, completion_tokens, duration_ms, tokens_per_second)
     VALUES (@id, @conversationId, @role, @content, @thinking, @toolCallsJson, @createdAt, @model, @promptTokens, @completionTokens, @durationMs, @tokensPerSecond)`
  ).run({
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    thinking: message.thinking ?? null,
    toolCallsJson: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
    createdAt: message.createdAt,
    model: message.model ?? null,
    promptTokens: message.promptTokens ?? null,
    completionTokens: message.completionTokens ?? null,
    durationMs: message.durationMs ?? null,
    tokensPerSecond: message.tokensPerSecond ?? null,
  });
}

export function updateMessage(message: ChatMessage): void {
  db.prepare(
    `UPDATE messages SET content = @content, thinking = @thinking, tool_calls_json = @toolCallsJson,
     prompt_tokens = @promptTokens, completion_tokens = @completionTokens, duration_ms = @durationMs, tokens_per_second = @tokensPerSecond
     WHERE id = @id`
  ).run({
    id: message.id,
    content: message.content,
    thinking: message.thinking ?? null,
    toolCallsJson: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
    promptTokens: message.promptTokens ?? null,
    completionTokens: message.completionTokens ?? null,
    durationMs: message.durationMs ?? null,
    tokensPerSecond: message.tokensPerSecond ?? null,
  });
}

export function listMessages(conversationId: string): ChatMessage[] {
  const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId) as unknown as MessageRow[];
  return rows.map(rowToMessage);
}

export function getMessage(id: string): ChatMessage | null {
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow | undefined;
  return row ? rowToMessage(row) : null;
}
