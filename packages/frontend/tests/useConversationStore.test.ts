import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../src/services/wsClient", () => ({ wsClient: { send: vi.fn(), on: vi.fn(), onConnectionChange: vi.fn(), connect: vi.fn() } }));
vi.mock("../src/services/api", () => ({ api: {} }));

import { useConversationStore } from "../src/stores/useConversationStore";

describe("useConversationStore.handleAgentStatus", () => {
  beforeEach(() => {
    useConversationStore.setState({
      streamingByConversation: {},
      agentStatusByConversation: {},
    });
  });

  it("clears the streaming buffer when the agent reaches the 'stopped' state", () => {
    // Regression test: a user-cancelled generation reaches a terminal
    // "stopped" status without any chat:message-complete event ever
    // following it, since the request was aborted mid-stream. Before this
    // fix, the streaming buffer (and therefore the composer's "busy"
    // indicator / Stop button) never cleared.
    useConversationStore.getState().handleChatToken("c1", "m1", "partial response");
    expect(useConversationStore.getState().streamingByConversation["c1"]).toBeDefined();

    useConversationStore.getState().handleAgentStatus({ conversationId: "c1", state: "stopped", iteration: 1, maxIterations: 1 });

    expect(useConversationStore.getState().streamingByConversation["c1"]).toBeUndefined();
  });

  it("clears the streaming buffer when the agent reaches the 'error' state", () => {
    useConversationStore.getState().handleChatToken("c1", "m1", "partial response");
    useConversationStore.getState().handleAgentStatus({ conversationId: "c1", state: "error", iteration: 1, maxIterations: 1 });
    expect(useConversationStore.getState().streamingByConversation["c1"]).toBeUndefined();
  });

  it("does not clear the streaming buffer for non-terminal states like 'thinking'", () => {
    useConversationStore.getState().handleChatToken("c1", "m1", "partial response");
    useConversationStore.getState().handleAgentStatus({ conversationId: "c1", state: "thinking", iteration: 1, maxIterations: 1 });
    expect(useConversationStore.getState().streamingByConversation["c1"]).toBeDefined();
  });

  it("always records the status itself regardless of state", () => {
    useConversationStore.getState().handleAgentStatus({ conversationId: "c1", state: "stopped", iteration: 2, maxIterations: 5 });
    expect(useConversationStore.getState().agentStatusByConversation["c1"]).toEqual({
      conversationId: "c1",
      state: "stopped",
      iteration: 2,
      maxIterations: 5,
    });
  });
});
