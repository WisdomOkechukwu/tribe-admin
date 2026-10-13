import { ASSETS } from "./domain/catalog";
import type { AssetCode } from "./domain/types";

// Formatters are expensive to build; memoise one per shape. Times render in
// Lagos time on both server and client so SSR output never mismatches.
export const TZ = "Africa/Lagos";

const numCache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number, compact = false) {
  const key = `${min}:${max}:${compact}`;
  let f = numCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      ...(compact ? { notation: "compact" } : {}),
    });
    numCache.set(key, f);
  }
  return f;
}

/** Amount with the asset's precision. Crypto trims trailing zeros. */
export function fmtAmount(asset: AssetCode, n: number) {
  const a = ASSETS[asset];
  return a.kind === "crypto" && a.decimals > 2 ? nf(2, a.decimals).format(n) : nf(2, 2).format(n);
}

export function fmtMoney(asset: AssetCode, n: number, opts: { sign?: boolean } = {}) {
  const sign = opts.sign ? (n > 0 ? "+" : n < 0 ? "−" : "") : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const a = ASSETS[asset];
  return a.kind === "fiat" ? `${sign}${a.symbol}${fmtAmount(asset, abs)}` : `${sign}${fmtAmount(asset, abs)} ${asset}`;
}

export const fmtCompact = (n: number) => nf(0, 1, true).format(n);
export const fmtInt = (n: number) => nf(0, 0).format(n);
export const fmtPct = (n: number, digits = 2) => `${nf(0, digits).format(n)}%`;
export const fmtUsd = (n: number) => `$${nf(2, 2).format(n)}`;
export const fmtNgnCompact = (n: number) => `₦${fmtCompact(n)}`;

export function fmtRate(n: number) {
  if (n >= 100) return nf(2, 2).format(n);
  if (n >= 1) return nf(2, 4).format(n);
  return nf(2, 10).format(Number(n.toPrecision(6)));
}

const dt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const d = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const t = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtDateTime = (iso: string) => dt.format(new Date(iso));
export const fmtDate = (iso: string) => d.format(new Date(iso));
export const fmtTime = (iso: string) => t.format(new Date(iso));
/** YYYY-MM-DD in Lagos time. */
export const lagosDay = (iso: string | number) => dayKey.format(new Date(iso));

/** "3h ago" relative to a reference instant (never Date.now() during render). */
export function fmtAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const fullName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`;
export const initials = (c: { firstName: string; lastName: string }) => `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
