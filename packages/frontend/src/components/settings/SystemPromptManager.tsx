import { useEffect, useState } from "react";
import { Plus, Copy, Trash2, Save, Lock, Star } from "lucide-react";
import { usePromptProfilesStore } from "../../stores/usePromptProfilesStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import "./SystemPromptManager.css";

export function SystemPromptManager() {
  const { profiles, load, create, update, duplicate, remove } = usePromptProfilesStore();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId && profiles.length) setSelectedId(profiles[0].id);
  }, [profiles, selectedId]);

  const selected = profiles.find((p) => p.id === selectedId);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setContent(selected.content);
      setDirty(false);
    }
  }, [selected?.id]);

  async function handleCreate() {
    const profile = await create("New Profile", "You are a helpful assistant.");
    setSelectedId(profile.id);
  }

  async function handleSave() {
    if (!selected) return;
    await update(selected.id, { name, content });
    setDirty(false);
  }

  function isActive(id: string) {
    return settings?.ai.activeSystemPromptProfileId === id;
  }

  return (
    <div className="prompt-manager">
      <div className="prompt-manager-list">
        <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={handleCreate}>
          <Plus size={14} /> New Profile
        </button>
        <div className="prompt-manager-items scroll-area">
          {profiles.map((p) => (
            <div key={p.id} className="list-row" data-active={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
              {isActive(p.id) && <Star size={12} style={{ color: "var(--accent-400)" }} fill="var(--accent-400)" />}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              {p.builtIn && <Lock size={11} style={{ color: "var(--text-tertiary)" }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="prompt-manager-editor">
        {selected ? (
          <>
            <div className="prompt-editor-header">
              <input
                className="input"
                style={{ fontWeight: 600, fontSize: 14 }}
                value={name}
                disabled={selected.builtIn}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
              <button
                className={`btn btn-sm ${isActive(selected.id) ? "btn-primary" : "btn-secondary"}`}
                onClick={() => updateSettings({ ai: { ...settings!.ai, activeSystemPromptProfileId: selected.id } })}
              >
                <Star size={12} /> {isActive(selected.id) ? "Active" : "Set Active"}
              </button>
              <button className="btn btn-icon btn-sm btn-ghost" title="Duplicate" onClick={() => duplicate(selected.id)}>
                <Copy size={13} />
              </button>
              {!selected.builtIn && (
                <button
                  className="btn btn-icon btn-sm btn-danger-ghost"
                  title="Delete"
                  onClick={async () => {
                    if (window.confirm(`Delete "${selected.name}"?`)) {
                      await remove(selected.id);
                      setSelectedId(null);
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <textarea
              className="textarea prompt-editor-textarea"
              value={content}
              disabled={selected.builtIn}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
            />
            <div className="prompt-editor-footer">
              {selected.builtIn ? (
                <span className="resource-card-detail">Built-in profiles are read-only. Duplicate to customize.</span>
              ) : (
                <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
                  <Save size={13} /> Save Changes
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <p>Select or create a prompt profile.</p>
          </div>
        )}
      </div>
    </div>
  );
}
