import fs from "node:fs/promises";
import path from "node:path";
import type { FileEntry } from "@lacc/shared";
import { resolveWorkspacePath } from "../security/pathValidation.js";
import type { RegisteredTool } from "./types.js";

const MAX_READ_BYTES = 512 * 1024;
const MAX_SEARCH_RESULTS = 200;

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

export const listDirectoryTool: RegisteredTool = {
  definition: {
    id: "list_directory",
    name: "List Directory",
    description: "List the files and subdirectories inside a directory within an approved workspace.",
    category: "filesystem",
    riskLevel: "low",
    timeoutMs: 10_000,
    schema: {
      type: "object",
      properties: { path: { type: "string", description: "Absolute or workspace-relative directory path." } },
      required: ["path"],
    },
  },
  async handler(args, context) {
    const target = resolveWorkspacePath(context.workspaceRoots, String(args.path ?? "."));
    const names = await fs.readdir(target);
    const entries = await Promise.all(names.map((name) => statEntry(path.join(target, name))));
    entries.sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
    return { path: target, entries };
  },
};

export const readFileTool: RegisteredTool = {
  definition: {
    id: "read_file",
    name: "Read File",
    description: "Read the text contents of a file within an approved workspace.",
    category: "filesystem",
    riskLevel: "low",
    timeoutMs: 10_000,
    schema: {
      type: "object",
      properties: { path: { type: "string", description: "Absolute or workspace-relative file path." } },
      required: ["path"],
    },
  },
  async handler(args, context) {
    const target = resolveWorkspacePath(context.workspaceRoots, String(args.path));
    const st = await fs.stat(target);
    if (st.isDirectory()) throw new Error(`"${target}" is a directory, not a file.`);
    const fh = await fs.open(target, "r");
    try {
      const truncated = st.size > MAX_READ_BYTES;
      const buf = Buffer.alloc(Math.min(st.size, MAX_READ_BYTES));
      await fh.read(buf, 0, buf.length, 0);
      return { path: target, content: buf.toString("utf-8"), truncated, sizeBytes: st.size };
    } finally {
      await fh.close();
    }
  },
};

export const searchFilesTool: RegisteredTool = {
  definition: {
    id: "search_files",
    name: "Search Files",
    description: "Recursively search for files whose name contains the query string within an approved workspace.",
    category: "filesystem",
    riskLevel: "low",
    timeoutMs: 15_000,
    schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to search for in file names." },
        path: { type: "string", description: "Directory to search in (defaults to workspace root)." },
      },
      required: ["query"],
    },
  },
  async handler(args, context) {
    const root = resolveWorkspacePath(context.workspaceRoots, String(args.path ?? "."));
    const query = String(args.query).toLowerCase();
    const results: FileEntry[] = [];
    const skipDirs = new Set(["node_modules", ".git", "dist", "build", ".vite"]);

    async function walk(dir: string): Promise<void> {
      if (results.length >= MAX_SEARCH_RESULTS) return;
      let names: string[];
      try {
        names = await fs.readdir(dir);
      } catch {
        return;
      }
      for (const name of names) {
        if (results.length >= MAX_SEARCH_RESULTS) return;
        if (skipDirs.has(name)) continue;
        const full = path.join(dir, name);
        let st;
        try {
          st = await fs.stat(full);
        } catch {
          continue;
        }
        if (name.toLowerCase().includes(query)) {
          results.push(await statEntry(full));
        }
        if (st.isDirectory()) await walk(full);
      }
    }

    await walk(root);
    return { query, root, results };
  },
};

export const createFileTool: RegisteredTool = {
  definition: {
    id: "create_file",
    name: "Create File",
    description: "Create a new file with optional initial content within an approved workspace. Fails if the file already exists.",
    category: "filesystem",
    riskLevel: "medium",
    timeoutMs: 10_000,
    schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative or absolute path for the new file." },
        content: { type: "string", description: "Initial file content." },
      },
      required: ["path"],
    },
  },
  async handler(args, context) {
    const target = resolveWorkspacePath(context.workspaceRoots, String(args.path));
    try {
      await fs.access(target);
      throw new Error(`File already exists: ${target}`);
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, String(args.content ?? ""), "utf-8");
    return { path: target, created: true };
  },
};

export const writeFileTool: RegisteredTool = {
  definition: {
    id: "write_file",
    name: "Write File",
    description: "Overwrite a file's contents within an approved workspace. Creates the file if it does not exist.",
    category: "filesystem",
    riskLevel: "medium",
    timeoutMs: 10_000,
    schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative or absolute path." },
        content: { type: "string", description: "New full file content." },
      },
      required: ["path", "content"],
    },
  },
  async handler(args, context) {
    const target = resolveWorkspacePath(context.workspaceRoots, String(args.path));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, String(args.content), "utf-8");
    return { path: target, bytesWritten: Buffer.byteLength(String(args.content)) };
  },
};

export const editFileTool: RegisteredTool = {
  definition: {
    id: "edit_file",
    name: "Edit File",
    description: "Replace an exact, unique occurrence of text within an existing file. Fails if the search text is not found exactly once.",
    category: "filesystem",
    riskLevel: "medium",
    timeoutMs: 10_000,
    schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        search: { type: "string", description: "Exact text to find. Must be unique within the file." },
        replace: { type: "string", description: "Replacement text." },
      },
      required: ["path", "search", "replace"],
    },
  },
  async handler(args, context) {
    const target = resolveWorkspacePath(context.workspaceRoots, String(args.path));
    const content = await fs.readFile(target, "utf-8");
    const search = String(args.search);
    const occurrences = content.split(search).length - 1;
    if (occurrences === 0) throw new Error("Search text not found in file.");
    if (occurrences > 1) throw new Error(`Search text is not unique (found ${occurrences} occurrences).`);
    const updated = content.replace(search, String(args.replace));
    await fs.writeFile(target, updated, "utf-8");
    return { path: target, replaced: true };
  },
};

export const moveFileTool: RegisteredTool = {
  definition: {
    id: "move_file",
    name: "Move / Rename File",
    description: "Move or rename a file or directory within approved workspaces.",
    category: "filesystem",
    riskLevel: "medium",
    timeoutMs: 10_000,
    schema: {
      type: "object",
      properties: {
        sourcePath: { type: "string" },
        destinationPath: { type: "string" },
      },
      required: ["sourcePath", "destinationPath"],
    },
  },
  async handler(args, context) {
    const source = resolveWorkspacePath(context.workspaceRoots, String(args.sourcePath));
    const destination = resolveWorkspacePath(context.workspaceRoots, String(args.destinationPath));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rename(source, destination);
    return { source, destination, moved: true };
  },
};

export const fileTools: RegisteredTool[] = [
  listDirectoryTool,
  readFileTool,
  searchFilesTool,
  createFileTool,
  writeFileTool,
  editFileTool,
  moveFileTool,
];
