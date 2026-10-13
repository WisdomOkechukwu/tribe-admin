"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Recent = { id: string; name: string; tag: string };

type PaletteState = {
  open: boolean;
  recent: Recent[];
  setOpen: (open: boolean) => void;
  remember: (r: Recent) => void;
};

export const usePalette = create<PaletteState>()(
  persist(
    (set) => ({
      open: false,
      recent: [],
      setOpen: (open) => set({ open }),
      remember: (r) => set((s) => ({ recent: [r, ...s.recent.filter((x) => x.id !== r.id)].slice(0, 6) })),
    }),
    {
      name: "tribe-admin-palette",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ recent: s.recent }),
      skipHydration: true,
    },
  ),
);
