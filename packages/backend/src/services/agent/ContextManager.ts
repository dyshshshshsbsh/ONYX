import type { ChatMessage } from "@lacc/shared";
import type { ProviderChatMessage } from "../aiProvider/AIProvider.js";

const CHARS_PER_TOKEN_ESTIMATE = 4;
// Reserve headroom for the system prompt, the new user turn, and the
// completion itself — we don't have a real tokenizer here, so this is a
// deliberately conservative estimate, not an exact count.
const CONTEXT_RESERVE_FRACTION = 0.35;

export interface TrimResult {
  messages: ProviderChatMessage[];
  trimmed: boolean;
  keptMessages: number;
  droppedMessages: number;
}

/**
 * Builds the inference-time message list from full conversation history,
 * without ever mutating or deleting what's actually stored/shown to the
 * user. Older messages are dropped from the *model's* context once the
 * estimated token budget (derived from num_ctx) is exceeded — full
 * summarization would need another LLM pass, which on this hardware would
 * cost more latency than it saves, so we trim instead and say so explicitly
 * via a synthetic system note when it happens.
 */
export function buildInferenceContext(systemPrompt: string, history: ChatMessage[], numCtx: number): TrimResult {
  const budgetChars = Math.floor(numCtx * (1 - CONTEXT_RESERVE_FRACTION) * CHARS_PER_TOKEN_ESTIMATE);

  const kept: ChatMessage[] = [];
  let usedChars = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const len = m.content.length;
    if (kept.length > 0 && usedChars + len > budgetChars) break;
    kept.unshift(m);
    usedChars += len;
  }

  const droppedMessages = history.length - kept.length;
  const messages: ProviderChatMessage[] = [{ role: "system", content: systemPrompt }];
  if (droppedMessages > 0) {
    messages.push({
      role: "system",
      content: `(${droppedMessages} earlier message${droppedMessages === 1 ? "" : "s"} from this conversation were omitted to fit the model's context window. Continue naturally from the recent messages below.)`,
    });
  }
  messages.push(...kept.map((m) => ({ role: m.role, content: m.content }) as ProviderChatMessage));

  return { messages, trimmed: droppedMessages > 0, keptMessages: kept.length, droppedMessages };
}
