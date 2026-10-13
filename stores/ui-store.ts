"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Per-admin UI preferences. Persisted under "tribe-admin-ui"; the inline script
// in app/layout.tsx reads the same key before paint, so keep the shape in sync.
export type Theme = "light" | "dark" | "system";

type UiState = {
  theme: Theme;
  collapsed: boolean;
  mobileNav: boolean;
  /** Play a chime for new tickets / chat replies. */
  sound: boolean;
  setSound: (on: boolean) => void;
  setTheme: (t: Theme) => void;
  toggleCollapsed: () => void;
  setMobileNav: (open: boolean) => void;
};

export const resolveTheme = (t: Theme) =>
  t === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      collapsed: false,
      mobileNav: false,
      sound: true,
      setSound: (sound) => set({ sound }),
      setTheme: (theme) => {
        document.documentElement.dataset.theme = resolveTheme(theme);
        set({ theme });
      },
      toggleCollapsed: () =>
        set((s) => {
          const collapsed = !s.collapsed;
          if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
          else delete document.documentElement.dataset.sidebar;
          return { collapsed };
        }),
      setMobileNav: (mobileNav) => set({ mobileNav }),
    }),
    {
      name: "tribe-admin-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, collapsed: s.collapsed, sound: s.sound }),
      // Hydrate after mount (see StoreHydrator) so SSR markup never mismatches.
      skipHydration: true,
    },
  ),
);
