"use client";

import { create } from "zustand";

export type Toast = { id: number; tone: "success" | "error" | "info" | "support"; message: string; title?: string; href?: string; action?: string };

type ToastState = { toasts: Toast[]; push: (tone: Toast["tone"], message: string, extra?: Pick<Toast, "title" | "href" | "action">) => void; dismiss: (id: number) => void };

let n = 0;
export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (tone, message, extra) => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message, ...extra }] }));
    setTimeout(() => get().dismiss(id), tone === "error" || tone === "support" ? 8000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable from any client handler. */
export const toast = {
  success: (m: string) => useToasts.getState().push("success", m),
  error: (m: string) => useToasts.getState().push("error", m),
  info: (m: string) => useToasts.getState().push("info", m),
  support: (title: string, m: string, href: string) => useToasts.getState().push("support", m, { title, href, action: "Open" }),
};
