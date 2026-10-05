import { describe, it, expect } from "vitest";
import { formatBytes, formatDuration, formatUptime, formatRelativeTime, formatTokensPerSecond } from "../src/utils/format";

describe("formatBytes", () => {
  it("formats zero and falsy values as 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes without decimals", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes, megabytes, and gigabytes with the right unit", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });
});

describe("formatDuration", () => {
  it("formats sub-second durations in ms", () => {
    expect(formatDuration(250)).toBe("250ms");
  });

  it("formats durations under a minute in seconds", () => {
    expect(formatDuration(4200)).toBe("4.2s");
  });

  it("formats durations over a minute as m/s", () => {
    expect(formatDuration(75_000)).toBe("1m 15s");
  });
});

describe("formatUptime", () => {
  it("always includes minutes even when zero", () => {
    expect(formatUptime(30_000)).toBe("0m");
  });

  it("includes hours and days when present", () => {
    const ms = (2 * 86400 + 3 * 3600 + 5 * 60) * 1000;
    expect(formatUptime(ms)).toBe("2d 3h 5m");
  });
});

describe("formatRelativeTime", () => {
  it("reports 'just now' for very recent timestamps", () => {
    expect(formatRelativeTime(Date.now() - 1000)).toBe("just now");
  });

  it("reports seconds ago for sub-minute timestamps", () => {
    expect(formatRelativeTime(Date.now() - 30_000)).toBe("30s ago");
  });

  it("reports minutes ago for sub-hour timestamps", () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe("5m ago");
  });
});

describe("formatTokensPerSecond", () => {
  it("renders an em-dash placeholder when undefined", () => {
    expect(formatTokensPerSecond(undefined)).toBe("—");
  });

  it("formats a numeric rate to one decimal place", () => {
    expect(formatTokensPerSecond(12.345)).toBe("12.3 tok/s");
  });
});
