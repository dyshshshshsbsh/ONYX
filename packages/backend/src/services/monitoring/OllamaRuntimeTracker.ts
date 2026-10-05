class OllamaRuntimeTracker {
  private activeRequests = 0;
  private lastRequestDurationMs: number | undefined;
  private lastTokensPerSecond: number | undefined;
  private lastTtftMs: number | undefined;
  /** conversationId currently generating, if any. Used to enforce "max 1 active generation" globally. */
  private activeConversationId: string | null = null;

  beginRequest(conversationId: string): void {
    this.activeRequests += 1;
    this.activeConversationId = conversationId;
  }

  endRequest(durationMs: number, tokensPerSecond: number | undefined): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.lastRequestDurationMs = durationMs;
    this.lastTokensPerSecond = tokensPerSecond;
    if (this.activeRequests === 0) this.activeConversationId = null;
  }

  recordTtft(ttftMs: number): void {
    this.lastTtftMs = ttftMs;
  }

  /** Returns the conversationId already generating, or null if the caller may proceed. */
  tryAcquire(conversationId: string): string | null {
    if (this.activeConversationId && this.activeConversationId !== conversationId) {
      return this.activeConversationId;
    }
    return null;
  }

  getActiveRequests(): number {
    return this.activeRequests;
  }

  getLastRequestDurationMs(): number | undefined {
    return this.lastRequestDurationMs;
  }

  getLastTokensPerSecond(): number | undefined {
    return this.lastTokensPerSecond;
  }

  getLastTtftMs(): number | undefined {
    return this.lastTtftMs;
  }
}

export const ollamaRuntimeTracker = new OllamaRuntimeTracker();
