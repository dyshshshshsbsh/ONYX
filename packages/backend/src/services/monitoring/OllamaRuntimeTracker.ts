class OllamaRuntimeTracker {
  private activeRequests = 0;
  private lastRequestDurationMs: number | undefined;
  private lastTokensPerSecond: number | undefined;

  beginRequest(): void {
    this.activeRequests += 1;
  }

  endRequest(durationMs: number, tokensPerSecond: number | undefined): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.lastRequestDurationMs = durationMs;
    this.lastTokensPerSecond = tokensPerSecond;
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
}

export const ollamaRuntimeTracker = new OllamaRuntimeTracker();
