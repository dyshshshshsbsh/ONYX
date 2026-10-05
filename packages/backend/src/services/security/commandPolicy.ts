export class CommandBlockedError extends Error {
  constructor(public readonly pattern: string) {
    super(`Command blocked by Security settings (matches blocked pattern "${pattern}").`);
    this.name = "CommandBlockedError";
  }
}

export function assertCommandAllowed(command: string, blockedPatterns: string[]): void {
  const lower = command.toLowerCase();
  for (const pattern of blockedPatterns) {
    if (!pattern.trim()) continue;
    if (lower.includes(pattern.toLowerCase())) {
      throw new CommandBlockedError(pattern);
    }
  }
}
