import { create } from "zustand";

export interface Toast {
  id: string;
  level: "success" | "warning" | "error" | "info";
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (level: Toast["level"], message: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (level, message) => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, level, message }] });
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
