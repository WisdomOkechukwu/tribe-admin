"use client";

import { create } from "zustand";
import type { RateMargin, TransactionFee } from "@/lib/domain/types";

// Draft state for the pricing editor (modal and /rates page): rate margins per
// asset and fees per transaction type. Values stay as the strings the admin
// typed (and the API's decimal strings), so nothing is rounded through floats.
// Rows subscribe to their own key via selectors, so typing in one row
// re-renders only that row.

export type MarginDraft = { asset: string; buyPct: string; sellPct: string; version: number };
export type FeeDraft = { type: string; feePct: string; flatFee: string; maxFee: string; active: boolean; flatFeeAsset: string; version: number };
export type MarginField = "buyPct" | "sellPct";
export type FeeField = "feePct" | "flatFee" | "maxFee";

type PricingState = {
  open: boolean;
  tab: "margins" | "fees";
  margins: Record<string, MarginDraft>;
  marginsInitial: Record<string, MarginDraft>;
  fees: Record<string, FeeDraft>;
  feesInitial: Record<string, FeeDraft>;
  show: (tab?: "margins" | "fees") => void;
  close: () => void;
  setTab: (tab: "margins" | "fees") => void;
  /** Load server data into the drafts (on open, and after a save re-renders the host). */
  load: (margins: RateMargin[], fees: TransactionFee[]) => void;
  setMargin: (asset: string, f: MarginField, raw: string) => void;
  setFee: (type: string, f: FeeField, raw: string) => void;
  toggleFee: (type: string, active?: boolean) => void;
  reset: () => void;
};

const marginDraft = (m: RateMargin): MarginDraft => ({ asset: m.asset, buyPct: trimPct(m.buyPct), sellPct: trimPct(m.sellPct), version: m.version });
const feeDraft = (f: TransactionFee): FeeDraft => ({ type: f.type, feePct: trimPct(f.feePct), flatFee: f.flatFee, maxFee: f.maxFee ?? "", active: f.active, flatFeeAsset: f.flatFeeAsset, version: f.version });

/** "1.000000" → "1", "0.250000" → "0.25". */
function trimPct(v: string) {
  return v.includes(".") ? v.replace(/0+$/, "").replace(/\.$/, "") : v;
}

export const usePricing = create<PricingState>()((set) => ({
  open: false,
  tab: "margins",
  margins: {},
  marginsInitial: {},
  fees: {},
  feesInitial: {},
  show: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
  close: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
  load: (margins, fees) => {
    const m = Object.fromEntries(margins.map((x) => [x.asset, marginDraft(x)]));
    const f = Object.fromEntries(fees.map((x) => [x.type, feeDraft(x)]));
    set({ margins: m, marginsInitial: m, fees: f, feesInitial: f });
  },
  setMargin: (asset, f, raw) => set((s) => ({ margins: { ...s.margins, [asset]: { ...s.margins[asset], [f]: raw.trim() } } })),
  setFee: (type, f, raw) => set((s) => ({ fees: { ...s.fees, [type]: { ...s.fees[type], [f]: raw.trim() } } })),
  toggleFee: (type, active) => set((s) => ({ fees: { ...s.fees, [type]: { ...s.fees[type], active: active ?? !s.fees[type].active } } })),
  reset: () => set((s) => ({ margins: s.marginsInitial, fees: s.feesInitial })),
}));

const num = (v: string) => (v === "" ? NaN : Number(v));
const sameNum = (a: string, b: string) => a === b || (a !== "" && b !== "" && num(a) === num(b));
const sameMargin = (a?: MarginDraft, b?: MarginDraft) => !!a && !!b && sameNum(a.buyPct, b.buyPct) && sameNum(a.sellPct, b.sellPct);
const sameFee = (a?: FeeDraft, b?: FeeDraft) => !!a && !!b && sameNum(a.feePct, b.feePct) && sameNum(a.flatFee, b.flatFee) && (a.maxFee === b.maxFee || sameNum(a.maxFee, b.maxFee)) && a.active === b.active;

export const isPct = (v: string, max: number) => /^\d+(\.\d{1,6})?$/.test(v) && Number(v) <= max;
export const isAmount = (v: string) => /^\d+(\.\d{1,8})?$/.test(v);

export const useMarginDirty = (asset: string) => usePricing((s) => !sameMargin(s.margins[asset], s.marginsInitial[asset]));
export const useFeeDirty = (type: string) => usePricing((s) => !sameFee(s.fees[type], s.feesInitial[type]));
export const useDirtyCount = () =>
  usePricing((s) => Object.keys(s.margins).filter((k) => !sameMargin(s.margins[k], s.marginsInitial[k])).length + Object.keys(s.fees).filter((k) => !sameFee(s.fees[k], s.feesInitial[k])).length);

/** Changed rows, ready for the save actions. */
export function changedPricing() {
  const s = usePricing.getState();
  return {
    margins: Object.values(s.margins).filter((m) => !sameMargin(m, s.marginsInitial[m.asset])),
    fees: Object.values(s.fees)
      .filter((f) => !sameFee(f, s.feesInitial[f.type]))
      .map((f) => ({ type: f.type, feePct: f.feePct, flatFee: f.flatFee, flatFeeAsset: f.flatFeeAsset, maxFee: f.maxFee === "" ? null : f.maxFee, active: f.active, version: f.version })),
  };
}

/** Any invalid value in the drafts (blocks saving). */
export const useHasInvalid = () =>
  usePricing((s) => Object.values(s.margins).some((m) => !isPct(m.buyPct, 25) || !isPct(m.sellPct, 25)) || Object.values(s.fees).some((f) => !isPct(f.feePct, 10) || !isAmount(f.flatFee) || (f.maxFee !== "" && !isAmount(f.maxFee))));
