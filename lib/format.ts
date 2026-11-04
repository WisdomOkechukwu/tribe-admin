import { assetInfo } from "./domain/catalog";

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

/** A number, or an exact decimal string from the API ("12.50"). Strings are formatted without float rounding. */
export type Num = number | string;

const asNum = (n: Num): number | Intl.StringNumericLiteral => (typeof n === "string" ? ((n.trim() || "0") as Intl.StringNumericLiteral) : n);
/** -1, 0 or 1. Works on decimal strings without parsing them into floats. */
export function signOf(n: Num): -1 | 0 | 1 {
  if (typeof n === "number") return n > 0 ? 1 : n < 0 ? -1 : 0;
  const t = n.trim();
  if (!/[1-9]/.test(t)) return 0;
  return t.startsWith("-") ? -1 : 1;
}
const absOf = (n: Num): Num => (typeof n === "number" ? Math.abs(n) : n.trim().replace(/^[-+]/, ""));

/** Amount with the asset's precision. Crypto trims trailing zeros. */
export function fmtAmount(asset: string, n: Num) {
  const a = assetInfo(asset);
  return a.kind === "crypto" && a.decimals > 2 ? nf(2, a.decimals).format(asNum(n)) : nf(2, 2).format(asNum(n));
}

export function fmtMoney(asset: string, n: Num, opts: { sign?: boolean } = {}) {
  const s = signOf(n);
  const sign = opts.sign ? (s > 0 ? "+" : s < 0 ? "−" : "") : s < 0 ? "−" : "";
  const abs = absOf(n);
  const a = assetInfo(asset);
  return a.kind === "fiat" && a.symbol !== a.code ? `${sign}${a.symbol}${fmtAmount(asset, abs)}` : `${sign}${fmtAmount(asset, abs)} ${a.code}`;
}

/** Plain number from a decimal string, for charts and ratios only (never for money maths). */
export const toNum = (n: Num | null | undefined) => {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
};

export const fmtCompact = (n: Num) => nf(0, 1, true).format(asNum(n));
export const fmtInt = (n: Num) => nf(0, 0).format(asNum(n));
export const fmtPct = (n: Num, digits = 2) => `${nf(0, digits).format(asNum(n))}%`;
export const fmtUsd = (n: Num) => `$${nf(2, 2).format(asNum(n))}`;
export const fmtNgnCompact = (n: Num) => `₦${fmtCompact(n)}`;

export function fmtRate(value: Num) {
  const n = toNum(value);
  if (n >= 100) return nf(2, 2).format(n);
  if (n >= 1) return nf(2, 4).format(n);
  if (n === 0) return "0";
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
