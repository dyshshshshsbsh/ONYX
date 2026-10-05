import type { InferenceProfileConfig, InferenceProfileName } from "@lacc/shared";
import { readGpuSnapshot } from "../monitoring/GpuMonitor.js";

/**
 * Hardware-aware inference presets.
 *
 * num_ctx is the single biggest lever on VRAM usage: KV-cache size scales
 * roughly linearly with context length, and on a 4GB card there is very
 * little headroom once the model weights themselves are loaded. Rather than
 * hardcoding one value, we size FAST/BALANCED against detected VRAM so the
 * same profile stays safe whether this is a 4GB laptop GPU or a much bigger
 * card, while DEEP is only allowed to grow on hardware that can actually
 * afford it.
 */
let cachedPresets: Record<InferenceProfileName, InferenceProfileConfig> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

function presetsForVram(vramTotalBytes: number | undefined): Record<InferenceProfileName, InferenceProfileConfig> {
  const vramGb = vramTotalBytes ? vramTotalBytes / 1024 ** 3 : undefined;

  // Conservative defaults for unknown / CPU-only / very low VRAM (<=4GB, the
  // reference hardware this app targets).
  let fastCtx = 2048;
  let balancedCtx = 4096;
  let deepCtx = 6144;

  if (vramGb !== undefined) {
    if (vramGb > 10) {
      fastCtx = 4096;
      balancedCtx = 8192;
      deepCtx = 16384;
    } else if (vramGb > 6) {
      fastCtx = 3072;
      balancedCtx = 6144;
      deepCtx = 10240;
    } else if (vramGb > 4) {
      fastCtx = 2560;
      balancedCtx = 5120;
      deepCtx = 8192;
    }
    // <=4GB keeps the conservative defaults above.
  }

  return {
    fast: {
      name: "fast",
      label: "Fast",
      description: "Quickest answers: thinking disabled, short context, short generation budget.",
      think: false,
      numCtx: fastCtx,
      numPredict: 384,
      temperature: 0.6,
      topP: 0.9,
    },
    balanced: {
      name: "balanced",
      label: "Balanced",
      description: "Normal day-to-day use: moderate context and generation budget.",
      think: false,
      numCtx: balancedCtx,
      numPredict: 896,
      temperature: 0.7,
      topP: 0.9,
    },
    deep: {
      name: "deep",
      label: "Deep",
      description: "Full reasoning enabled for hard problems. Slower — only use when you need it.",
      think: true,
      numCtx: deepCtx,
      numPredict: 2048,
      temperature: 0.7,
      topP: 0.95,
    },
  };
}

export async function getInferenceProfiles(): Promise<Record<InferenceProfileName, InferenceProfileConfig>> {
  const now = Date.now();
  if (cachedPresets && now - cachedAt < CACHE_TTL_MS) return cachedPresets;
  const gpu = await readGpuSnapshot();
  cachedPresets = presetsForVram(gpu.available ? gpu.vramTotalBytes : undefined);
  cachedAt = now;
  return cachedPresets;
}

export async function getInferenceProfile(name: InferenceProfileName): Promise<InferenceProfileConfig> {
  const profiles = await getInferenceProfiles();
  return profiles[name];
}
