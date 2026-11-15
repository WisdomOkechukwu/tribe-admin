import { assetInfo } from "./catalog";
import type { Amount } from "./types";

// Exact conversions between the API's smallest units ("2000") and decimal
// strings ("20.00"). String maths only: money never passes through a float.

/** "2000" with 2 dp → "20.00". Already-decimal input is returned as-is. */
export function unitsToDecimal(units: string | number | null | undefined, decimals: number): Amount {
  const raw = String(units ?? "0").trim() || "0";
  if (!/^-?\d+$/.test(raw)) return raw;
  if (decimals <= 0) return raw;
  const neg = raw.startsWith("-");
  const digits = (neg ? raw.slice(1) : raw).padStart(decimals + 1, "0");
  return `${neg ? "-" : ""}${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

/** Smallest units of `asset` → decimal string with the asset's decimal places. */
export const fromUnits = (asset: string, units: string | number | null | undefined) => unitsToDecimal(units, assetInfo(asset).decimals);

/** Validates a human-typed amount ("1,250.5") into a clean decimal string, or null. */
export function cleanDecimal(input: string, maxDecimals: number): string | null {
  const t = input.replace(/[,\s_]/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [, frac = ""] = t.split(".");
  if (frac.length > maxDecimals) return null;
  return t.replace(/^0+(?=\d)/, "");
}

/**
 * Compares two decimal strings exactly (no floats): -1 if a < b, 0 if equal, 1 if a > b.
 * Used to keep a manual credit within Tribe Funds, and a debit within the wallet.
 */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const scale = Math.max(a.split(".")[1]?.length ?? 0, b.split(".")[1]?.length ?? 0);
  const units = (v: string) => {
    const negative = v.trim().startsWith("-");
    const [whole, frac = ""] = v.trim().replace(/^[-+]/, "").split(".");
    const n = BigInt((whole || "0") + frac.padEnd(scale, "0"));
    return negative ? -n : n;
  };
  const x = units(a), y = units(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Exact decimal add of two decimal strings with `decimals` places (BigInt, no floats). */
export function addDecimal(a: string, b: string, decimals: number): string {
  const units = (v: string) => {
    const negative = v.startsWith("-");
    const [whole, frac = ""] = v.replace(/^-/, "").split(".");
    const n = BigInt((whole || "0") + frac.padEnd(decimals, "0").slice(0, decimals));
    return negative ? -n : n;
  };
  const sum = units(a) + units(b);
  const negative = sum < BigInt(0);
  const digits = (negative ? -sum : sum).toString().padStart(decimals + 1, "0");
  const out = decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
  return negative ? `-${out}` : out;
}
