import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { ChatPage } from "./pages/ChatPage";
import { AgentPage } from "./pages/AgentPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ToolsPage } from "./pages/ToolsPage";
import { SystemPage } from "./pages/SystemPage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { initializeRealtime } from "./services/realtime";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useConversationStore } from "./stores/useConversationStore";
import { useModelsStore } from "./stores/useModelsStore";
import { useToolsStore } from "./stores/useToolsStore";
import { useUiStore } from "./stores/useUiStore";

export default function App() {
  const navigate = useNavigate();
  const loadSettings = useSettingsStore((s) => s.load);
  const loadConversations = useConversationStore((s) => s.loadConversations);
  const createConversation = useConversationStore((s) => s.createConversation);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const stop = useConversationStore((s) => s.stop);
  const refreshModels = useModelsStore((s) => s.refresh);
  const refreshTools = useToolsStore((s) => s.refresh);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    initializeRealtime();
    loadSettings();
    loadConversations();
    refreshModels();
    refreshTools();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        createConversation(settings?.ai.defaultModel ?? "qwen3:4b", settings?.ai.activeSystemPromptProfileId ?? null);
        navigate("/chat");
      } else if (meta && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
      } else if (e.key === "Escape" && activeConversationId) {
        stop(activeConversationId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeConversationId, settings, navigate]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
