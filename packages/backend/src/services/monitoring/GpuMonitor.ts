import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GpuSnapshot } from "@lacc/shared";

const execFileAsync = promisify(execFile);

const QUERY_FIELDS = [
  "name",
  "utilization.gpu",
  "memory.total",
  "memory.used",
  "temperature.gpu",
  "driver_version",
].join(",");

let nvidiaSmiMissing = false;

export async function readGpuSnapshot(): Promise<GpuSnapshot> {
  if (nvidiaSmiMissing) {
    return { available: false, unavailableReason: "nvidia-smi not found on this system." };
  }
  try {
    const { stdout } = await execFileAsync("nvidia-smi", [`--query-gpu=${QUERY_FIELDS}`, "--format=csv,noheader,nounits"], {
      timeout: 3000,
    });
    const line = stdout.trim().split("\n")[0];
    if (!line) return { available: false, unavailableReason: "nvidia-smi returned no data." };
    const [name, util, memTotal, memUsed, temp, driver] = line.split(",").map((s) => s.trim());
    const vramTotalBytes = Number(memTotal) * 1024 * 1024;
    const vramUsedBytes = Number(memUsed) * 1024 * 1024;
    return {
      available: true,
      name,
      utilizationPercent: Number(util),
      vramTotalBytes,
      vramUsedBytes,
      vramPercent: vramTotalBytes > 0 ? (vramUsedBytes / vramTotalBytes) * 100 : 0,
      temperatureC: Number(temp) || undefined,
      driverVersion: driver,
    };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      nvidiaSmiMissing = true;
      return { available: false, unavailableReason: "nvidia-smi not found on this system." };
    }
    return { available: false, unavailableReason: `GPU query failed: ${err?.message ?? "unknown error"}` };
  }
}
