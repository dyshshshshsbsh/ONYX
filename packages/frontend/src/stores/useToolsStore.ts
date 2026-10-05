import { create } from "zustand";
import type { ToolDefinition } from "@lacc/shared";
import { api } from "../services/api";

export type ToolWithVerdict = ToolDefinition & { verdict: string; sessionGranted: boolean };

interface ToolsState {
  tools: ToolWithVerdict[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useToolsStore = create<ToolsState>((set) => ({
  tools: [],
  loading: true,
  refresh: async () => {
    set({ loading: true });
    const { tools } = await api.tools.list();
    set({ tools, loading: false });
  },
}));
