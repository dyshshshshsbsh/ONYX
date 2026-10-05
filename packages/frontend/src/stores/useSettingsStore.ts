import { create } from "zustand";
import type { AppSettings } from "@lacc/shared";
import { api } from "../services/api";
import { useToastStore } from "./useToastStore";

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
}

function applyTheme(theme: AppSettings["general"]["theme"]): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: true,
  load: async () => {
    set({ loading: true });
    try {
      const { settings } = await api.settings.get();
      set({ settings, loading: false });
      applyTheme(settings.general.theme);
    } catch {
      set({ loading: false });
      useToastStore.getState().push("error", "Failed to load settings from backend.");
    }
  },
  update: async (partial) => {
    const { settings } = await api.settings.update(partial);
    set({ settings });
    applyTheme(settings.general.theme);
  },
  reset: async () => {
    const { settings } = await api.settings.reset();
    set({ settings });
    applyTheme(settings.general.theme);
  },
}));
