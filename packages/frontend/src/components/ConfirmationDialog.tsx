import { ShieldAlert } from "lucide-react";
import { useConversationStore } from "../stores/useConversationStore";

export function ConfirmationDialog() {
  const pending = useConversationStore((s) => s.pendingConfirmations[0]);
  const resolveConfirmation = useConversationStore((s) => s.resolveConfirmation);

  if (!pending) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog" role="alertdialog" aria-modal="true">
        <div className="dialog-header">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <ShieldAlert size={20} style={{ color: `var(--risk-${pending.riskLevel})`, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="dialog-title">Agent wants to run a tool</div>
              <div className="card-subtitle" style={{ marginTop: 4 }}>
                {pending.toolName}
              </div>
            </div>
          </div>
          <span className={`risk-tag risk-${pending.riskLevel}`}>{pending.riskLevel} risk</span>
        </div>
        <div className="dialog-body">
          <div className="code-block" style={{ marginTop: 10 }}>
            <div className="code-block-header">arguments</div>
            <pre>{JSON.stringify(pending.args, null, 2)}</pre>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-danger-ghost" onClick={() => resolveConfirmation(pending.id, "deny")}>
            Deny
          </button>
          <button className="btn btn-secondary" onClick={() => resolveConfirmation(pending.id, "allow-session")}>
            Allow Session
          </button>
          <button className="btn btn-primary" onClick={() => resolveConfirmation(pending.id, "allow-once")}>
            Allow Once
          </button>
        </div>
      </div>
    </div>
  );
}
