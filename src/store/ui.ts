import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      toasts: [],
      toast: (message, tone = 'success') => {
        const id = ++seq;
        set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
      },
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    { name: 'secretsanta:ui', partialize: (s) => ({ theme: s.theme }) },
  ),
);

export const toast = (m: string, tone?: Toast['tone']) => useUi.getState().toast(m, tone);
