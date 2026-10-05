import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileEntry } from "@lacc/shared";
import { getSettings } from "../storage/repositories/settingsRepository.js";
import { resolveWorkspacePath, PathAccessDeniedError } from "../services/security/pathValidation.js";

export const fsRouter = Router();

async function statEntry(fullPath: string): Promise<FileEntry> {
  const st = await fs.stat(fullPath);
  return {
    name: path.basename(fullPath),
    path: fullPath,
    isDirectory: st.isDirectory(),
    sizeBytes: st.size,
    modifiedAt: st.mtimeMs,
    extension: st.isDirectory() ? undefined : path.extname(fullPath).replace(".", ""),
  };
}

function handleFsError(err: any, res: any): void {
  if (err instanceof PathAccessDeniedError) {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err?.code === "ENOENT") {
    res.status(404).json({ error: "Path not found." });
    return;
  }
  res.status(500).json({ error: err?.message ?? "Filesystem error." });
}

fsRouter.get("/workspaces", (_req, res) => {
  const settings = getSettings();
  res.json({ roots: settings.security.workspaceRoots });
});

fsRouter.get("/list", async (req, res) => {
  const settings = getSettings();
  try {
    const target = resolveWorkspacePath(settings.security.workspaceRoots, String(req.query.path ?? "."));
    const names = await fs.readdir(target);
    const entries = await Promise.all(names.map((name) => statEntry(path.join(target, name))));
    entries.sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
    res.json({ path: target, entries });
  } catch (err: any) {
    handleFsError(err, res);
  }
});

fsRouter.get("/read", async (req, res) => {
  const settings = getSettings();
  try {
    const target = resolveWorkspacePath(settings.security.workspaceRoots, String(req.query.path));
    const st = await fs.stat(target);
    if (st.isDirectory()) throw new Error("Cannot read a directory as a file.");
    const MAX = 1024 * 1024;
    const truncated = st.size > MAX;
    const fh = await fs.open(target, "r");
    const buf = Buffer.alloc(Math.min(st.size, MAX));
    await fh.read(buf, 0, buf.length, 0);
    await fh.close();
    res.json({ path: target, content: buf.toString("utf-8"), truncated, sizeBytes: st.size, modifiedAt: st.mtimeMs });
  } catch (err: any) {
    handleFsError(err, res);
  }
});

fsRouter.post("/write", async (req, res) => {
  const settings = getSettings();
  if (!settings.security.permissions.fileModify) {
    res.status(403).json({ error: "File modification is disabled in Security settings." });
    return;
  }
  try {
    const { path: reqPath, content } = req.body as { path: string; content: string };
    const target = resolveWorkspacePath(settings.security.workspaceRoots, reqPath);
    await fs.writeFile(target, content ?? "", "utf-8");
    res.json({ path: target, saved: true });
  } catch (err: any) {
    handleFsError(err, res);
  }
});

fsRouter.post("/create", async (req, res) => {
  const settings = getSettings();
  if (!settings.security.permissions.fileCreate) {
    res.status(403).json({ error: "File creation is disabled in Security settings." });
    return;
  }
  try {
    const { path: reqPath, content, isDirectory } = req.body as { path: string; content?: string; isDirectory?: boolean };
    const target = resolveWorkspacePath(settings.security.workspaceRoots, reqPath);
    if (isDirectory) {
      await fs.mkdir(target, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content ?? "", { flag: "wx" });
    }
    res.status(201).json({ path: target, created: true });
  } catch (err: any) {
    handleFsError(err, res);
  }
});

fsRouter.post("/move", async (req, res) => {
  const settings = getSettings();
  if (!settings.security.permissions.fileModify) {
    res.status(403).json({ error: "File modification is disabled in Security settings." });
    return;
  }
  try {
    const { source, destination } = req.body as { source: string; destination: string };
    const s = resolveWorkspacePath(settings.security.workspaceRoots, source);
    const d = resolveWorkspacePath(settings.security.workspaceRoots, destination);
    await fs.mkdir(path.dirname(d), { recursive: true });
    await fs.rename(s, d);
    res.json({ source: s, destination: d, moved: true });
  } catch (err: any) {
    handleFsError(err, res);
  }
});

fsRouter.delete("/delete", async (req, res) => {
  const settings = getSettings();
  if (!settings.security.permissions.fileDelete) {
    res.status(403).json({ error: "File deletion is disabled in Security settings." });
    return;
  }
  try {
    const target = resolveWorkspacePath(settings.security.workspaceRoots, String(req.query.path));
    await fs.rm(target, { recursive: true });
    res.json({ path: target, deleted: true });
  } catch (err: any) {
    handleFsError(err, res);
  }
});
