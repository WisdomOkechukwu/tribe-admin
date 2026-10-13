"use client";

import { create } from "zustand";

/** Live support state pushed over SSE. */
type SupportState = { unread: number; connected: boolean; setUnread: (n: number) => void; setConnected: (c: boolean) => void };

export const useSupport = create<SupportState>()((set) => ({
  unread: 0,
  connected: false,
  setUnread: (unread) => set({ unread }),
  setConnected: (connected) => set({ connected }),
}));
