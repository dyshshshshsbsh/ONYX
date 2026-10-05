import { useEffect, useState } from "react";
import { Folder, File, FilePlus, FolderPlus, Save, RefreshCw, ChevronRight } from "lucide-react";
import type { FileEntry } from "@lacc/shared";
import { api, ApiError } from "../../services/api";
import { useToastStore } from "../../stores/useToastStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { formatBytes, formatRelativeTime } from "../../utils/format";
import "./FileExplorerTab.css";

export function FileExplorerTab() {
  const [root, setRoot] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const push = useToastStore((s) => s.push);
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    api.fs.workspaces().then(({ roots }) => {
      const r = roots[0] ?? "";
      setRoot(r);
      setCurrentPath(r);
    });
  }, []);

  useEffect(() => {
    if (currentPath) loadDir(currentPath);
  }, [currentPath]);

  async function loadDir(path: string) {
    setLoading(true);
    try {
      const { entries } = await api.fs.list(path);
      setEntries(entries);
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Failed to list directory.");
    } finally {
      setLoading(false);
    }
  }

  async function openEntry(entry: FileEntry) {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      setSelected(null);
      return;
    }
    try {
      const file = await api.fs.read(entry.path);
      setSelected(entry);
      setContent(file.content);
      setTruncated(file.truncated);
      setDirty(false);
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Failed to read file.");
    }
  }

  async function handleSave() {
    if (!selected) return;
    try {
      await api.fs.write(selected.path, content);
      setDirty(false);
      push("success", `Saved ${selected.name}`);
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Failed to save file.");
    }
  }

  async function handleNewFile() {
    const name = window.prompt("New file name:");
    if (!name) return;
    try {
      await api.fs.create(`${currentPath}\\${name}`, "");
      loadDir(currentPath);
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Failed to create file.");
    }
  }

  async function handleNewFolder() {
    const name = window.prompt("New folder name:");
    if (!name) return;
    try {
      await api.fs.create(`${currentPath}\\${name}`, undefined, true);
      loadDir(currentPath);
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Failed to create folder.");
    }
  }

  const relative = root && currentPath.startsWith(root) ? currentPath.slice(root.length).replace(/^[\\/]/, "") : currentPath;
  const crumbs = relative ? relative.split(/[\\/]/).filter(Boolean) : [];

  return (
    <div className="file-explorer">
      <div className="file-explorer-tree">
        <div className="file-explorer-toolbar">
          <div className="breadcrumbs">
            <span className="breadcrumb-root" onClick={() => setCurrentPath(root)}>
              workspace
            </span>
            {crumbs.map((c, i) => (
              <span key={i} className="breadcrumb-item">
                <ChevronRight size={11} />
                {c}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-icon btn-sm btn-ghost" title="New file" onClick={handleNewFile} disabled={!settings?.security.permissions.fileCreate}>
              <FilePlus size={14} />
            </button>
            <button className="btn btn-icon btn-sm btn-ghost" title="New folder" onClick={handleNewFolder} disabled={!settings?.security.permissions.fileCreate}>
              <FolderPlus size={14} />
            </button>
            <button className="btn btn-icon btn-sm btn-ghost" title="Refresh" onClick={() => loadDir(currentPath)}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <div className="file-explorer-list scroll-area">
          {loading ? (
            <div className="skeleton" style={{ height: 200, margin: 10 }} />
          ) : entries.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <p>Empty directory</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.path} className="list-row file-row" data-active={selected?.path === entry.path} onClick={() => openEntry(entry)}>
                {entry.isDirectory ? <Folder size={14} style={{ color: "var(--accent-400)" }} /> : <File size={14} style={{ color: "var(--text-tertiary)" }} />}
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                {!entry.isDirectory && <span className="file-row-meta">{formatBytes(entry.sizeBytes)}</span>}
                <span className="file-row-meta">{formatRelativeTime(entry.modifiedAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="file-explorer-preview">
        {selected ? (
          <>
            <div className="file-preview-header">
              <span>{selected.name}</span>
              {truncated && <span className="badge badge-warning">Truncated preview</span>}
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!dirty || !settings?.security.permissions.fileModify}>
                <Save size={12} /> Save
              </button>
            </div>
            <textarea
              className="textarea file-preview-editor"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              readOnly={!settings?.security.permissions.fileModify}
              spellCheck={false}
            />
          </>
        ) : (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <p>Select a file to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
