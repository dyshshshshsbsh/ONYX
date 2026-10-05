import { describe, it, expect } from "vitest";
import { statusForPercent } from "../src/components/charts/thresholds";

describe("statusForPercent", () => {
  it("returns accent below 70%", () => {
    expect(statusForPercent(0)).toBe("accent");
    expect(statusForPercent(69.9)).toBe("accent");
  });

  it("returns warning from 70% up to (not including) 90%", () => {
    expect(statusForPercent(70)).toBe("warning");
    expect(statusForPercent(89.9)).toBe("warning");
  });

  it("returns danger at 90% and above", () => {
    expect(statusForPercent(90)).toBe("danger");
    expect(statusForPercent(100)).toBe("danger");
  });
});
