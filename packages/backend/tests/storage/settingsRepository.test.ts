import { describe, it, expect, beforeEach } from "vitest";
import { getSettings, updateSettings, resetSettings, DEFAULT_SETTINGS } from "../../src/storage/repositories/settingsRepository.js";

describe("settingsRepository", () => {
  beforeEach(() => {
    resetSettings();
  });

  it("returns the default settings when nothing has been stored yet", () => {
    const settings = getSettings();
    expect(settings.ai.defaultModel).toBe(DEFAULT_SETTINGS.ai.defaultModel);
    expect(settings.security.permissions.fileDelete).toBe(false);
  });

  it("persists a partial update and merges it over the existing settings", () => {
    updateSettings({ ai: { ...DEFAULT_SETTINGS.ai, temperature: 0.2 } });
    const settings = getSettings();
    expect(settings.ai.temperature).toBe(0.2);
    // Untouched sibling fields of the same nested object are preserved.
    expect(settings.ai.defaultModel).toBe(DEFAULT_SETTINGS.ai.defaultModel);
    // Untouched sibling sections are preserved too.
    expect(settings.agent.maxIterations).toBe(DEFAULT_SETTINGS.agent.maxIterations);
  });

  it("deep-merges a nested permission change without clobbering other permissions", () => {
    updateSettings({ security: { ...DEFAULT_SETTINGS.security, permissions: { ...DEFAULT_SETTINGS.security.permissions, fileDelete: true } } });
    const settings = getSettings();
    expect(settings.security.permissions.fileDelete).toBe(true);
    expect(settings.security.permissions.fileRead).toBe(DEFAULT_SETTINGS.security.permissions.fileRead);
  });

  it("persists across repeated reads (not just in-memory for one call)", () => {
    updateSettings({ general: { ...DEFAULT_SETTINGS.general, theme: "light" } });
    expect(getSettings().general.theme).toBe("light");
    expect(getSettings().general.theme).toBe("light");
  });

  it("resetSettings restores every section to defaults", () => {
    updateSettings({ ai: { ...DEFAULT_SETTINGS.ai, temperature: 1.9 }, logLevel: "debug" });
    resetSettings();
    const settings = getSettings();
    expect(settings.ai.temperature).toBe(DEFAULT_SETTINGS.ai.temperature);
    expect(settings.logLevel).toBe(DEFAULT_SETTINGS.logLevel);
  });
});
