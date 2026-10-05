import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Several tests hit real OS APIs (systeminformation, child_process) which
    // can be slow under CPU contention on modest hardware.
    testTimeout: 15000,
    env: {
      LACC_DATA_DIR: path.resolve(__dirname, ".vitest-data"),
    },
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
