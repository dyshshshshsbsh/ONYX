import { useLocation } from "react-router-dom";
import { Command, Menu, Moon, Sun, SunMoon } from "lucide-react";
import { useUiStore } from "../stores/useUiStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useSystemStore } from "../stores/useSystemStore";
import "./TopBar.css";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/chat": "Chat",
  "/agent": "Agent Activity",
  "/models": "Models",
  "/tools": "Tools",
  "/system": "System Diagnostics",
  "/logs": "Logs",
  "/settings": "Settings",
};

function resolveTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] ?? "Onyx";
}

const THEME_ICONS = { dark: Moon, light: Sun, system: SunMoon };

export function TopBar() {
  const location = useLocation();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const wsConnected = useSystemStore((s) => s.wsConnected);
  const snapshot = useSystemStore((s) => s.snapshot);

  const theme = settings?.general.theme ?? "dark";
  const ThemeIcon = THEME_ICONS[theme];

  function cycleTheme() {
    const order: Array<typeof theme> = ["dark", "light", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    updateSettings({ general: { ...settings!.general, theme: next } });
  }

  return (
    <header className="topbar">
      <button className="btn btn-icon btn-ghost topbar-menu-btn" onClick={() => setMobileSidebarOpen(true)} title="Open menu">
        <Menu size={17} />
      </button>
      <h1 className="topbar-title">{resolveTitle(location.pathname)}</h1>

      <button className="topbar-search" onClick={() => setCommandPaletteOpen(true)}>
        <Command size={13} />
        <span>Command palette</span>
        <kbd>Ctrl</kbd>
        <kbd>K</kbd>
      </button>

      <div className="topbar-right">
        <span className="badge" data-live-dot={wsConnected || undefined}>
          <span className="badge-dot" style={{ color: wsConnected ? "var(--success-500)" : "var(--danger-500)" }} />
          {wsConnected ? "Live" : "Disconnected"}
        </span>
        {snapshot && (
          <span className="badge" title="GPU utilization">
            GPU {snapshot.gpu.available ? `${Math.round(snapshot.gpu.utilizationPercent ?? 0)}%` : "N/A"}
          </span>
        )}
        <button className="btn btn-icon btn-ghost" onClick={cycleTheme} title={`Theme: ${theme}`}>
          <ThemeIcon size={16} />
        </button>
      </div>
    </header>
  );
}
