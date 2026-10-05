import { describe, it, expect, beforeEach, vi } from "vitest";
import { useToastStore } from "../src/stores/useToastStore";

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useRealTimers();
  });

  it("push adds a toast with the given level and message", () => {
    useToastStore.getState().push("success", "Saved");
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ level: "success", message: "Saved" });
  });

  it("dismiss removes only the targeted toast", () => {
    useToastStore.getState().push("info", "first");
    useToastStore.getState().push("info", "second");
    const [first, second] = useToastStore.getState().toasts;
    useToastStore.getState().dismiss(first.id);
    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("auto-dismisses a toast after 5 seconds", () => {
    vi.useFakeTimers();
    useToastStore.getState().push("warning", "will fade");
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });
});
