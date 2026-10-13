"use client";

import { create } from "zustand";

/** Which transaction the quick-view drawer shows (one drawer for the whole app). */
type TxDrawerState = { id: string | null; show: (id: string) => void; close: () => void };

export const useTxDrawer = create<TxDrawerState>()((set) => ({
  id: null,
  show: (id) => set({ id }),
  close: () => set({ id: null }),
}));
