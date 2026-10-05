import { useEffect, useState } from "react";
import { Download, RefreshCw, Trash2, Boxes, Zap } from "lucide-react";
import { useModelsStore } from "../stores/useModelsStore";
import { formatBytes, formatDate } from "../utils/format";
import "./ModelsPage.css";

export function ModelsPage() {
  const { models, running, pullProgress, loading, error, refresh, pull, remove } = useModelsStore();
  const [pullName, setPullName] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  async function handlePull() {
    if (!pullName.trim()) return;
    await pull(pullName.trim());
    setPullName("");
  }

  return (
    <div className="models-page">
      <div className="models-toolbar">
        <div className="field" style={{ flex: 1, maxWidth: 420 }}>
          <div className="input-row">
            <input
              className="input"
              placeholder="Model name to pull, e.g. llama3.2:3b"
              value={pullName}
              onChange={(e) => setPullName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePull()}
            />
            <button className="btn btn-primary" onClick={handlePull}>
              <Download size={14} /> Pull
            </button>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={refresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {Object.values(pullProgress).filter((p) => !p.done).length > 0 && (
        <div className="pull-progress-list">
          {Object.values(pullProgress)
            .filter((p) => !p.done)
            .map((p) => (
              <div key={p.model} className="card card-pad pull-progress-item">
                <div className="pull-progress-header">
                  <span>{p.model}</span>
                  <span className="resource-card-detail">{p.status}</span>
                </div>
                {p.total ? (
                  <div className="meter-track" style={{ marginTop: 8 }}>
                    <div className="meter-fill" style={{ width: `${((p.completed ?? 0) / p.total) * 100}%` }} />
                  </div>
                ) : (
                  <div className="meter-track" style={{ marginTop: 8 }}>
                    <div className="meter-fill" style={{ width: "30%" }} />
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {error && (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <div className="empty-state-icon">
            <Boxes size={20} />
          </div>
          <p>{error}</p>
        </div>
      )}

      {!error && (
        <div className="models-grid">
          {loading && models.length === 0
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 140 }} />)
            : models.map((m) => {
                const isRunning = running.some((r) => r.name === m.name);
                return (
                  <div key={m.name} className="card card-pad model-card">
                    <div className="model-card-header">
                      <span className="card-title">{m.name}</span>
                      {isRunning && (
                        <span className="badge badge-accent badge-pulse">
                          <span className="badge-dot" />
                          Running
                        </span>
                      )}
                    </div>
                    <div className="model-card-meta">
                      <span>{formatBytes(m.size)}</span>
                      {m.parameterSize && <span>{m.parameterSize}</span>}
                      {m.quantizationLevel && <span>{m.quantizationLevel}</span>}
                    </div>
                    {m.capabilities && m.capabilities.length > 0 && (
                      <div className="model-card-caps">
                        {m.capabilities.map((c) => (
                          <span key={c} className="badge">
                            {c === "tools" && <Zap size={10} />}
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="model-card-footer">
                      <span className="resource-card-detail">{formatDate(new Date(m.modifiedAt).getTime())}</span>
                      <button
                        className="btn btn-danger-ghost btn-sm"
                        onClick={() => window.confirm(`Remove ${m.name}?`) && remove(m.name)}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
          {!loading && models.length === 0 && (
            <div className="empty-state" style={{ paddingTop: 60, gridColumn: "1 / -1" }}>
              <div className="empty-state-icon">
                <Boxes size={20} />
              </div>
              <p>No models installed yet. Pull one above to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
