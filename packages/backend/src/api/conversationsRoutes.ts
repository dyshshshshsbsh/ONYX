import { Router } from "express";
import * as repo from "../storage/repositories/conversationRepository.js";
import { getSettings } from "../storage/repositories/settingsRepository.js";
import { listToolExecutions } from "../storage/repositories/toolExecutionRepository.js";

export const conversationsRouter = Router();

conversationsRouter.get("/", (req, res) => {
  const includeArchived = req.query.archived === "true";
  res.json({ conversations: repo.listConversations(includeArchived) });
});

conversationsRouter.post("/", (req, res) => {
  const settings = getSettings();
  const { title, model, systemPromptProfileId } = req.body as {
    title?: string;
    model?: string;
    systemPromptProfileId?: string | null;
  };
  const conversation = repo.createConversation(
    title || "New Conversation",
    model || settings.ai.defaultModel,
    systemPromptProfileId ?? settings.ai.activeSystemPromptProfileId
  );
  res.status(201).json({ conversation });
});

conversationsRouter.get("/:id", (req, res) => {
  const conversation = repo.getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  res.json({ conversation });
});

conversationsRouter.get("/:id/messages", (req, res) => {
  res.json({ messages: repo.listMessages(req.params.id) });
});

conversationsRouter.get("/:id/tool-executions", (req, res) => {
  res.json({ toolExecutions: listToolExecutions(req.params.id) });
});

conversationsRouter.patch("/:id", (req, res) => {
  const conversation = repo.getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const { title, archived, systemPromptProfileId, model } = req.body as {
    title?: string;
    archived?: boolean;
    systemPromptProfileId?: string | null;
    model?: string;
  };
  if (typeof title === "string") repo.renameConversation(req.params.id, title);
  if (typeof archived === "boolean") repo.setConversationArchived(req.params.id, archived);
  if (systemPromptProfileId !== undefined) repo.setConversationSystemPromptProfile(req.params.id, systemPromptProfileId);
  if (typeof model === "string") repo.setConversationModel(req.params.id, model);
  res.json({ conversation: repo.getConversation(req.params.id) });
});

conversationsRouter.delete("/:id", (req, res) => {
  repo.deleteConversation(req.params.id);
  res.json({ deleted: true });
});
