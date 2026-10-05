import { Router } from "express";
import * as repo from "../storage/repositories/promptProfileRepository.js";

export const promptProfilesRouter = Router();

promptProfilesRouter.get("/", (_req, res) => {
  res.json({ profiles: repo.listProfiles() });
});

promptProfilesRouter.post("/", (req, res) => {
  const { name, content } = req.body as { name?: string; content?: string };
  if (!name || !content) {
    res.status(400).json({ error: "name and content are required." });
    return;
  }
  res.status(201).json({ profile: repo.createProfile(name, content) });
});

promptProfilesRouter.patch("/:id", (req, res) => {
  const existing = repo.getProfile(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const { name, content } = req.body as { name?: string; content?: string };
  const updated = repo.updateProfile(req.params.id, name ?? existing.name, content ?? existing.content);
  res.json({ profile: updated });
});

promptProfilesRouter.post("/:id/duplicate", (req, res) => {
  const duplicate = repo.duplicateProfile(req.params.id);
  if (!duplicate) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.status(201).json({ profile: duplicate });
});

promptProfilesRouter.delete("/:id", (req, res) => {
  const deleted = repo.deleteProfile(req.params.id);
  if (!deleted) {
    res.status(400).json({ error: "Built-in profiles cannot be deleted." });
    return;
  }
  res.json({ deleted: true });
});
