import type { PermissionDecision } from "@lacc/shared";

interface PendingEntry {
  resolve: (decision: PermissionDecision) => void;
}

export class ConfirmationBroker {
  private pending = new Map<string, PendingEntry>();

  await(confirmationId: string): Promise<PermissionDecision> {
    return new Promise((resolve) => {
      this.pending.set(confirmationId, { resolve });
    });
  }

  resolve(confirmationId: string, decision: PermissionDecision): boolean {
    const entry = this.pending.get(confirmationId);
    if (!entry) return false;
    this.pending.delete(confirmationId);
    entry.resolve(decision);
    return true;
  }

  cancelAll(): void {
    for (const [id, entry] of this.pending) {
      entry.resolve("deny");
      this.pending.delete(id);
    }
  }
}

export const confirmationBroker = new ConfirmationBroker();
