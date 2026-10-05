const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";
const MAX_PARTIAL_TAG_LENGTH = Math.max(OPEN_TAG.length, CLOSE_TAG.length) - 1;

/**
 * Some Ollama model/version combinations (notably qwen3) emit reasoning as
 * inline <think>...</think> tags inside the regular content stream instead of
 * using the dedicated `message.thinking` field. This stateful splitter
 * reclassifies that inline reasoning as "thinking" text across chunk
 * boundaries, so the UI can always rely on a clean separation regardless of
 * how a given model chooses to emit it.
 */
export class ThinkTagSplitter {
  private buffer = "";
  private inThink = false;

  feed(rawChunk: string): { content: string; thinking: string } {
    this.buffer += rawChunk;
    let content = "";
    let thinking = "";

    while (true) {
      const tag = this.inThink ? CLOSE_TAG : OPEN_TAG;
      const tagIndex = this.buffer.indexOf(tag);

      if (tagIndex === -1) {
        const safeLength = Math.max(0, this.buffer.length - MAX_PARTIAL_TAG_LENGTH);
        const emittable = this.buffer.slice(0, safeLength);
        this.buffer = this.buffer.slice(safeLength);
        if (this.inThink) thinking += emittable;
        else content += emittable;
        break;
      }

      const before = this.buffer.slice(0, tagIndex);
      if (this.inThink) thinking += before;
      else content += before;
      this.buffer = this.buffer.slice(tagIndex + tag.length);
      this.inThink = !this.inThink;
    }

    return { content, thinking };
  }

  flush(): { content: string; thinking: string } {
    const remaining = this.buffer;
    this.buffer = "";
    return this.inThink ? { content: "", thinking: remaining } : { content: remaining, thinking: "" };
  }
}

/**
 * Non-streaming, authoritative version of the same split, run once over the
 * complete accumulated text. Used to correct the final persisted message,
 * because some Ollama/model combinations (observed with qwen3) emit a
 * literal "</think>" marker with NO matching opening tag — the model's
 * template silently starts in reasoning mode. The incremental streaming
 * splitter can't detect that until the closing tag finally arrives, so this
 * pass re-classifies the whole text once it is fully known: if a "</think>"
 * appears with no prior "<think>", everything up to and including it is
 * reasoning, not content.
 */
export function splitThinkTagsFull(fullText: string): { content: string; thinking: string } {
  let content = "";
  let thinking = "";
  let rest = fullText;

  while (true) {
    const openIndex = rest.indexOf(OPEN_TAG);
    const closeIndex = rest.indexOf(CLOSE_TAG);

    if (openIndex === -1 && closeIndex === -1) {
      content += rest;
      break;
    }

    if (closeIndex !== -1 && (openIndex === -1 || closeIndex < openIndex)) {
      // A closing tag appears before any opening tag (or with none at all):
      // everything up to it was implicit reasoning.
      thinking += rest.slice(0, closeIndex);
      rest = rest.slice(closeIndex + CLOSE_TAG.length);
      continue;
    }

    // Well-formed case: content, then <think>...</think>.
    content += rest.slice(0, openIndex);
    const afterOpen = rest.slice(openIndex + OPEN_TAG.length);
    const closeInThink = afterOpen.indexOf(CLOSE_TAG);
    if (closeInThink === -1) {
      thinking += afterOpen;
      rest = "";
      break;
    }
    thinking += afterOpen.slice(0, closeInThink);
    rest = afterOpen.slice(closeInThink + CLOSE_TAG.length);
  }

  return { content, thinking };
}
