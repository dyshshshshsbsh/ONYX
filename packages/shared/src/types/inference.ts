import type { InferenceProfileName } from "./chat.js";

export interface InferenceProfileConfig {
  name: InferenceProfileName;
  label: string;
  description: string;
  think: boolean;
  numCtx: number;
  numPredict: number;
  temperature: number;
  topP: number;
}

export type ModelState = "unknown" | "loading" | "ready" | "idle";

export interface ModelRuntimeState {
  model: string | null;
  state: ModelState;
  vramBytes?: number;
  expiresAt?: string;
  exceedsHardware?: boolean;
  hardwareWarning?: string;
}
