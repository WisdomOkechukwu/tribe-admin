"use client";

import { create } from "zustand";
import type { MarkupRule, TxType } from "@/lib/domain/types";

// Draft state for the markup modal. Rows subscribe to their own txType via
// selectors, so typing in one row re-renders only that row.
export type Draft = Pick<MarkupRule, "txType" | "ratePct" | "feePct" | "flatFee" | "active">;
type Field = "ratePct" | "feePct" | "flatFee";

type MarkupState = {
  open: boolean;
  initial: Record<string, Draft>;
  draft: Record<string, Draft>;
  /** Raw input text, so "1." or "" can be typed without being coerced away. */
  text: Record<string, string>;
  show: () => void;
  /** Load server rules into the draft (on open, and after a save re-renders the host). */
  load: (rules: MarkupRule[]) => void;
  close: () => void;
  setField: (t: TxType, f: Field, raw: string) => void;
  toggle: (t: TxType, active?: boolean) => void;
  setAll: (active: boolean) => void;
  reset: () => void;
  commit: () => void;
};

const pick = (r: MarkupRule): Draft => ({ txType: r.txType, ratePct: r.ratePct, feePct: r.feePct, flatFee: r.flatFee, active: r.active });
const textFor = (d: Record<string, Draft>) => {
  const t: Record<string, string> = {};
  for (const r of Object.values(d)) {
    t[`${r.txType}.ratePct`] = String(r.ratePct);
    t[`${r.txType}.feePct`] = String(r.feePct);
    t[`${r.txType}.flatFee`] = String(r.flatFee);
  }
  return t;
};

export const useMarkups = create<MarkupState>()((set) => ({
  open: false,
  initial: {},
  draft: {},
  text: {},
  show: () => set({ open: true }),
  load: (rules) => {
    const initial = Object.fromEntries(rules.map((r) => [r.txType, pick(r)]));
    set({ initial, draft: { ...initial }, text: textFor(initial) });
  },
  close: () => set({ open: false }),
  setField: (t, f, raw) =>
    set((s) => {
      const n = Number(raw);
      const text = { ...s.text, [`${t}.${f}`]: raw };
      if (raw.trim() === "" || !Number.isFinite(n)) return { text };
      return { text, draft: { ...s.draft, [t]: { ...s.draft[t], [f]: n } } };
    }),
  toggle: (t, active) => set((s) => ({ draft: { ...s.draft, [t]: { ...s.draft[t], active: active ?? !s.draft[t].active } } })),
  setAll: (active) => set((s) => ({ draft: Object.fromEntries(Object.entries(s.draft).map(([k, v]) => [k, { ...v, active }])) })),
  reset: () => set((s) => ({ draft: { ...s.initial }, text: textFor(s.initial) })),
  commit: () => set((s) => ({ initial: { ...s.draft } })),
}));

const same = (a?: Draft, b?: Draft) => !!a && !!b && a.ratePct === b.ratePct && a.feePct === b.feePct && a.flatFee === b.flatFee && a.active === b.active;

export const useRowDirty = (t: TxType) => useMarkups((s) => !same(s.draft[t], s.initial[t]));
export const useDirtyCount = () => useMarkups((s) => Object.keys(s.draft).filter((k) => !same(s.draft[k], s.initial[k])).length);
export const changedDrafts = () => {
  const s = useMarkups.getState();
  return Object.values(s.draft).filter((d) => !same(d, s.initial[d.txType]));
};
