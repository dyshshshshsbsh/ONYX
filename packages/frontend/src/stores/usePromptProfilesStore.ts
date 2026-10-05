import { create } from "zustand";
import type { SystemPromptProfile } from "@lacc/shared";
import { api } from "../services/api";

interface PromptProfilesState {
  profiles: SystemPromptProfile[];
  loading: boolean;
  load: () => Promise<void>;
  create: (name: string, content: string) => Promise<SystemPromptProfile>;
  update: (id: string, payload: { name?: string; content?: string }) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePromptProfilesStore = create<PromptProfilesState>((set, get) => ({
  profiles: [],
  loading: true,
  load: async () => {
    set({ loading: true });
    const { profiles } = await api.promptProfiles.list();
    set({ profiles, loading: false });
  },
  create: async (name, content) => {
    const { profile } = await api.promptProfiles.create(name, content);
    set({ profiles: [...get().profiles, profile] });
    return profile;
  },
  update: async (id, payload) => {
    const { profile } = await api.promptProfiles.update(id, payload);
    set({ profiles: get().profiles.map((p) => (p.id === id ? profile : p)) });
  },
  duplicate: async (id) => {
    const { profile } = await api.promptProfiles.duplicate(id);
    set({ profiles: [...get().profiles, profile] });
  },
  remove: async (id) => {
    await api.promptProfiles.remove(id);
    set({ profiles: get().profiles.filter((p) => p.id !== id) });
  },
}));
