import { useState } from "react";
import { ChevronRight, CheckCircle2, XCircle, Loader2, Wrench } from "lucide-react";
import type { ToolCallRecord } from "@lacc/shared";
import "./ToolCallBubble.css";

export function ToolCallBubble({ call }: { call: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const running = !call.finishedAt;
  const failed = Boolean(call.error);

  return (
    <div className="tool-call-bubble" data-state={running ? "running" : failed ? "error" : "success"}>
      <button className="tool-call-header" onClick={() => setExpanded((e) => !e)}>
        <ChevronRight size={13} className="tool-call-chevron" data-open={expanded} />
        <Wrench size={13} />
        <span className="tool-call-name">{call.toolId}</span>
        <span className={`risk-tag risk-${call.riskLevel}`}>{call.riskLevel}</span>
        <span className="tool-call-status">
          {running ? <Loader2 size={13} className="spin" /> : failed ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
        </span>
      </button>
      {expanded && (
        <div className="tool-call-body">
          <div className="code-block">
            <div className="code-block-header">arguments</div>
            <pre>{JSON.stringify(call.args, null, 2)}</pre>
          </div>
          {call.error ? (
            <div className="code-block" style={{ marginTop: 8 }}>
              <div className="code-block-header">error</div>
              <pre style={{ color: "var(--danger-500)" }}>{call.error}</pre>
            </div>
          ) : call.result !== undefined ? (
            <div className="code-block" style={{ marginTop: 8 }}>
              <div className="code-block-header">result</div>
              <pre>{typeof call.result === "string" ? call.result : JSON.stringify(call.result, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
