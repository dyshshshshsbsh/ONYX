import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Bot, User, ChevronDown, BrainCircuit } from "lucide-react";
import type { ChatMessage } from "@lacc/shared";
import { ToolCallBubble } from "./ToolCallBubble";
import { CodeBlockPre } from "./CodeBlock";
import { formatDuration, formatTokensPerSecond } from "../../utils/format";
import "./MessageBubble.css";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [showThinking, setShowThinking] = useState(false);

  if (message.role === "user") {
    return (
      <div className="msg-row msg-row-user">
        <div className="msg-bubble msg-bubble-user">{message.content}</div>
      </div>
    );
  }

  if (message.role === "tool") return null;

  return (
    <div className="msg-row msg-row-assistant">
      <div className="msg-avatar">
        <Bot size={15} />
      </div>
      <div className="msg-column">
        {message.thinking && (
          <div className="msg-thinking">
            <button className="msg-thinking-toggle" onClick={() => setShowThinking((v) => !v)}>
              <BrainCircuit size={13} />
              Thinking
              <ChevronDown size={13} data-open={showThinking} className="msg-thinking-chevron" />
            </button>
            {showThinking && <div className="msg-thinking-body">{message.thinking}</div>}
          </div>
        )}

        {message.toolCalls?.map((call) => <ToolCallBubble key={call.id} call={call} />)}

        {message.content && (
          <div className="msg-bubble msg-bubble-assistant markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ pre: CodeBlockPre }}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        <div className="msg-footer">
          {message.model && <span>{message.model}</span>}
          {message.durationMs !== undefined && <span>{formatDuration(message.durationMs)}</span>}
          {message.tokensPerSecond !== undefined && <span>{formatTokensPerSecond(message.tokensPerSecond)}</span>}
          {message.promptTokens !== undefined && <span>{message.promptTokens} prompt tok</span>}
          {message.completionTokens !== undefined && <span>{message.completionTokens} completion tok</span>}
        </div>
      </div>
    </div>
  );
}

export function StreamingBubble({ content, thinking }: { content: string; thinking: string }) {
  const [showThinking, setShowThinking] = useState(true);
  return (
    <div className="msg-row msg-row-assistant">
      <div className="msg-avatar msg-avatar-active">
        <Bot size={15} />
      </div>
      <div className="msg-column">
        {thinking && (
          <div className="msg-thinking">
            <button className="msg-thinking-toggle" onClick={() => setShowThinking((v) => !v)}>
              <BrainCircuit size={13} className="spin-slow" />
              Thinking…
              <ChevronDown size={13} data-open={showThinking} className="msg-thinking-chevron" />
            </button>
            {showThinking && <div className="msg-thinking-body">{thinking}</div>}
          </div>
        )}
        {content ? (
          <div className="msg-bubble msg-bubble-assistant markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ pre: CodeBlockPre }}>
              {content}
            </ReactMarkdown>
            <span className="msg-cursor" />
          </div>
        ) : !thinking ? (
          <div className="msg-bubble msg-bubble-assistant">
            <TypingDots />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="typing-dots">
      <span />
      <span />
      <span />
    </div>
  );
}
