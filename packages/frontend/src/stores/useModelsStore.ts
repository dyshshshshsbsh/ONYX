import { create } from "zustand";
import type { ModelPullProgress, OllamaModelSummary, OllamaRunningModel } from "@lacc/shared";
import { api } from "../services/api";
import { useToastStore } from "./useToastStore";

interface ModelsState {
  models: OllamaModelSummary[];
  running: OllamaRunningModel[];
  pullProgress: Record<string, ModelPullProgress>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pull: (name: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  applyPullProgress: (progress: ModelPullProgress) => void;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  running: [],
  pullProgress: {},
  loading: true,
  error: null,
  refresh: async () => {
    set({ loading: true });
    try {
      const [{ models }, { models: running }] = await Promise.all([api.models.list(), api.models.running()]);
      set({ models, running, loading: false, error: null });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? "Ollama unavailable." });
    }
  },
  pull: async (name) => {
    set({ pullProgress: { ...get().pullProgress, [name]: { model: name, status: "starting", done: false } } });
    await api.models.pull(name);
  },
  remove: async (name) => {
    await api.models.remove(name);
    await get().refresh();
  },
  applyPullProgress: (progress) => {
    set({ pullProgress: { ...get().pullProgress, [progress.model]: progress } });
    if (progress.done && !progress.error) {
      get().refresh();
      useToastStore.getState().push("success", `Model ${progress.model} installed.`);
    }
  },
}));
