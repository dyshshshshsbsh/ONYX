import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToastStore, type Toast } from "../stores/useToastStore";

const ICONS: Record<Toast["level"], typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};
const COLORS: Record<Toast["level"], string> = {
  success: "var(--success-500)",
  warning: "var(--warning-500)",
  error: "var(--danger-500)",
  info: "var(--info-500)",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.level];
        return (
          <div key={toast.id} className={`toast toast-${toast.level}`}>
            <Icon size={16} style={{ color: COLORS[toast.level], flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button className="btn btn-icon btn-sm btn-ghost" onClick={() => dismiss(toast.id)}>
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
