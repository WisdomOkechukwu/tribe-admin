"use client";

import { create } from "zustand";

/** Verification requests waiting for a reviewer: the sidebar badge (streamed in by KycPendingSync). */
type KycQueueState = { pending: number; setPending: (n: number) => void };

export const useKycQueue = create<KycQueueState>()((set) => ({
  pending: 0,
  setPending: (pending) => set({ pending }),
}));
