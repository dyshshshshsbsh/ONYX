import { describe, it, expect } from "vitest";
import { assertCommandAllowed, CommandBlockedError } from "../../src/services/security/commandPolicy.js";

describe("assertCommandAllowed", () => {
  it("allows a command that matches no blocked pattern", () => {
    expect(() => assertCommandAllowed("npm run build", ["format c:", "shutdown"])).not.toThrow();
  });

  it("blocks a command containing a blocked substring", () => {
    expect(() => assertCommandAllowed("shutdown /s /t 0", ["shutdown"])).toThrow(CommandBlockedError);
  });

  it("matches case-insensitively", () => {
    expect(() => assertCommandAllowed("SHUTDOWN now", ["shutdown"])).toThrow(CommandBlockedError);
  });

  it("ignores blank pattern entries", () => {
    expect(() => assertCommandAllowed("echo hi", ["", "   "])).not.toThrow();
  });

  it("reports the matched pattern on the thrown error", () => {
    try {
      assertCommandAllowed("rm -rf /", ["rm -rf /"]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CommandBlockedError);
      expect((err as CommandBlockedError).pattern).toBe("rm -rf /");
    }
  });
});
