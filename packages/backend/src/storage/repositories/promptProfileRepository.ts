import { randomUUID } from "node:crypto";
import type { SystemPromptProfile } from "@lacc/shared";
import { BUILT_IN_SYSTEM_PROMPT_PROFILES } from "@lacc/shared";
import { db } from "../db.js";

interface ProfileRow {
  id: string;
  name: string;
  content: string;
  built_in: number;
  created_at: number;
  updated_at: number;
}

function rowToProfile(row: ProfileRow): SystemPromptProfile {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    builtIn: Boolean(row.built_in),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function seedBuiltInProfiles(): void {
  const count = (db.prepare("SELECT COUNT(*) as c FROM system_prompt_profiles").get() as { c: number }).c;
  if (count > 0) return;
  const now = Date.now();
  const insert = db.prepare(
    "INSERT INTO system_prompt_profiles (id, name, content, built_in, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"
  );
  for (const profile of BUILT_IN_SYSTEM_PROMPT_PROFILES) {
    insert.run(randomUUID(), profile.name, profile.content, now, now);
  }
}

export function listProfiles(): SystemPromptProfile[] {
  const rows = db.prepare("SELECT * FROM system_prompt_profiles ORDER BY built_in DESC, created_at ASC").all() as unknown as ProfileRow[];
  return rows.map(rowToProfile);
}

export function getProfile(id: string): SystemPromptProfile | null {
  const row = db.prepare("SELECT * FROM system_prompt_profiles WHERE id = ?").get(id) as ProfileRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function createProfile(name: string, content: string): SystemPromptProfile {
  const now = Date.now();
  const profile: SystemPromptProfile = { id: randomUUID(), name, content, builtIn: false, createdAt: now, updatedAt: now };
  db.prepare("INSERT INTO system_prompt_profiles (id, name, content, built_in, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)").run(
    profile.id,
    profile.name,
    profile.content,
    profile.createdAt,
    profile.updatedAt
  );
  return profile;
}

export function updateProfile(id: string, name: string, content: string): SystemPromptProfile | null {
  const existing = getProfile(id);
  if (!existing) return null;
  const updatedAt = Date.now();
  db.prepare("UPDATE system_prompt_profiles SET name = ?, content = ?, updated_at = ? WHERE id = ?").run(name, content, updatedAt, id);
  return { ...existing, name, content, updatedAt };
}

export function deleteProfile(id: string): boolean {
  const existing = getProfile(id);
  if (!existing || existing.builtIn) return false;
  db.prepare("DELETE FROM system_prompt_profiles WHERE id = ?").run(id);
  return true;
}

export function duplicateProfile(id: string): SystemPromptProfile | null {
  const existing = getProfile(id);
  if (!existing) return null;
  return createProfile(`${existing.name} (Copy)`, existing.content);
}
