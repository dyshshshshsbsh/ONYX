import { Router } from "express";
import si from "systeminformation";
import { ollamaService } from "../container.js";
import { readSystemSnapshot } from "../services/monitoring/SystemMonitor.js";

export const systemRouter = Router();

systemRouter.get("/snapshot", async (_req, res) => {
  const snapshot = await readSystemSnapshot(ollamaService);
  res.json({ snapshot });
});

systemRouter.get("/processes", async (req, res) => {
  const limit = Number(req.query.limit) || 15;
  const data = await si.processes();
  const top = data.list
    .slice()
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, limit)
    .map((p) => ({ pid: p.pid, name: p.name, cpuPercent: Math.round(p.cpu * 10) / 10, memoryBytes: p.memRss * 1024 }));
  res.json({ total: data.all, processes: top });
});
