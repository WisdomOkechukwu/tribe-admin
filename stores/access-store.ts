"use client";

import { create } from "zustand";

/**
 * The signed-in admin's permissions, mirrored to the client purely for UI
 * (padlocks, hidden buttons). The server enforces everything regardless.
 * null = not loaded yet: render normally, no padlocks.
 */
type AccessState = { perms: Set<string> | null; set: (p: string[]) => void };

export const useAccessStore = create<AccessState>()((set) => ({ perms: null, set: (p) => set({ perms: new Set(p) }) }));

/** true/false once known; true while loading (avoids padlock flicker on the happy path). */
export const useCan = (p: string) => useAccessStore((s) => (s.perms ? s.perms.has(p) : true));
