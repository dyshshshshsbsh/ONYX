import { useState, type ReactNode, isValidElement } from "react";
import { Check, Copy } from "lucide-react";

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node.props as { children?: ReactNode }).children);
  return "";
}

export function CodeBlockPre({ children, ...props }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className: string = isValidElement(codeElement) ? ((codeElement.props as { className?: string }).className ?? "") : "";
  const match = /language-(\w+)/.exec(className);
  const lang = match?.[1] ?? "text";
  const rawText = extractText(children);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{lang}</span>
        <button className="btn btn-ghost btn-sm" onClick={handleCopy} style={{ height: 20, padding: "0 6px", color: "inherit" }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );
}
