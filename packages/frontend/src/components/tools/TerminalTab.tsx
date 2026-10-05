import { useEffect, useRef, useState } from "react";
import { Square, TerminalSquare } from "lucide-react";
import { wsClient } from "../../services/wsClient";
import { api } from "../../services/api";
import "./TerminalTab.css";

interface Line {
  kind: "prompt" | "stdout" | "stderr" | "exit";
  text: string;
}

export function TerminalTab() {
  const [cwd, setCwd] = useState("");
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.fs.workspaces().then(({ roots }) => setCwd(roots[0] ?? ""));
  }, []);

  useEffect(() => {
    return wsClient.on((event) => {
      if (event.type === "terminal:output" && event.sessionId === sessionIdRef.current) {
        setLines((prev) => [...prev, { kind: event.stream, text: event.chunk }]);
      }
      if (event.type === "terminal:exit" && event.sessionId === sessionIdRef.current) {
        setRunning(false);
        setLines((prev) => [...prev, { kind: "exit", text: `Exit code: ${event.exitCode ?? "—"} · Duration: ${(event.durationMs / 1000).toFixed(2)}s` }]);
      }
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function run() {
    if (!command.trim() || running) return;
    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    setLines((prev) => [...prev, { kind: "prompt", text: command }]);
    setRunning(true);
    wsClient.send({ type: "terminal:start", sessionId, command, cwd });
    setCommand("");
  }

  function cancel() {
    if (sessionIdRef.current) wsClient.send({ type: "terminal:cancel", sessionId: sessionIdRef.current });
  }

  return (
    <div className="terminal-tab">
      <div className="terminal-tab-cwd">
        <TerminalSquare size={13} />
        <input className="input" style={{ height: 26, fontFamily: "var(--font-mono)", fontSize: 12 }} value={cwd} onChange={(e) => setCwd(e.target.value)} />
      </div>
      <div className="terminal-panel terminal-tab-output scroll-area" ref={scrollRef}>
        {lines.length === 0 && <div style={{ color: "var(--text-tertiary)" }}>Run a command inside the workspace. Output streams live.</div>}
        {lines.map((line, i) => (
          <div key={i} className={line.kind === "stderr" ? "terminal-line-stderr" : undefined}>
            {line.kind === "prompt" ? (
              <>
                <span className="terminal-prompt">{cwd}&gt;</span> {line.text}
              </>
            ) : line.kind === "exit" ? (
              <div style={{ color: "var(--text-tertiary)", marginTop: 4, marginBottom: 8 }}>— {line.text} —</div>
            ) : (
              line.text
            )}
          </div>
        ))}
      </div>
      <div className="terminal-tab-input">
        <input
          className="input"
          style={{ fontFamily: "var(--font-mono)" }}
          placeholder="Type a command and press Enter…"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          disabled={running}
        />
        {running ? (
          <button className="btn btn-danger" onClick={cancel}>
            <Square size={13} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={run} disabled={!command.trim()}>
            Run
          </button>
        )}
      </div>
    </div>
  );
}
