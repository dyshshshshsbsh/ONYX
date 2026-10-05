import { Router } from "express";
import { toolRegistry } from "../container.js";
import { getSettings } from "../storage/repositories/settingsRepository.js";
import { permissionManager } from "../services/security/PermissionManager.js";

export const toolsRouter = Router();

toolsRouter.get("/", (_req, res) => {
  const settings = getSettings();
  const definitions = toolRegistry.list().map((def) => ({
    ...def,
    verdict: permissionManager.evaluate(def, settings.security.permissions, settings.agent),
    sessionGranted: permissionManager.hasSessionGrant(def.id),
  }));
  res.json({ tools: definitions });
});
