import path from "node:path";
import fs from "node:fs";

const explicitDataDir = process.env.LACC_DATA_DIR;

export const dataDir = explicitDataDir
  ? path.resolve(explicitDataDir)
  : path.resolve(process.cwd(), "../../data");

export const dbPath = path.join(dataDir, "app.db");

export function ensureDataDir(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}
