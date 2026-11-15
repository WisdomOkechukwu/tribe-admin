import type { AssetCode, TxCategory } from "./types";

// Display catalog: how each currency looks and the labels for backend codes.
// Live data (rates, balances, fees) always comes from the Go API.

export type AssetInfo = { code: AssetCode; name: string; kind: "crypto" | "fiat"; decimals: number; symbol: string; logo?: string };

/** Brand face per currency (mirrors the mobile app's coin colours), as theme tokens. */
export const ASSET_FACE: Record<AssetCode, { bg: string; fg: string }> = {
  NGN: { bg: "var(--color-success-700)", fg: "#fff" },
  USD: { bg: "var(--color-blue-500)", fg: "#fff" },
  GBP: { bg: "var(--color-purple-300)", fg: "#fff" },
  EUR: { bg: "var(--color-blue-700)", fg: "#fff" },
  KES: { bg: "var(--color-warning-500)", fg: "var(--color-ink-900)" },
  GHS: { bg: "var(--color-orange-700)", fg: "#fff" },
  CAD: { bg: "var(--color-error-600)", fg: "#fff" },
  BTC: { bg: "var(--color-orange-500)", fg: "#fff" },
  ETH: { bg: "var(--color-purple-700)", fg: "var(--color-purple-50)" },
  USDT: { bg: "var(--color-success-600)", fg: "#fff" },
  USDC: { bg: "var(--color-blue-600)", fg: "#fff" },
  SOL: { bg: "var(--color-ink-900)", fg: "var(--color-purple-200)" },
};

// Decimal places match the backend's assets table (GET /admin-api/currencies).
export const ASSETS: Record<AssetCode, AssetInfo> = {
  NGN: { code: "NGN", name: "Naira", kind: "fiat", decimals: 2, symbol: "₦", logo: "/logos/flags/ng.svg" },
  USD: { code: "USD", name: "US Dollar", kind: "fiat", decimals: 2, symbol: "$", logo: "/logos/flags/us.svg" },
  GBP: { code: "GBP", name: "British Pound", kind: "fiat", decimals: 2, symbol: "£", logo: "/logos/flags/gb.svg" },
  EUR: { code: "EUR", name: "Euro", kind: "fiat", decimals: 2, symbol: "€", logo: "/logos/flags/eu.svg" },
  KES: { code: "KES", name: "Kenyan Shilling", kind: "fiat", decimals: 2, symbol: "KSh", logo: "/logos/flags/ke.svg" },
  GHS: { code: "GHS", name: "Ghana Cedi", kind: "fiat", decimals: 2, symbol: "₵", logo: "/logos/flags/gh.svg" },
  CAD: { code: "CAD", name: "Canadian Dollar", kind: "fiat", decimals: 2, symbol: "C$", logo: "/logos/flags/ca.svg" },
  BTC: { code: "BTC", name: "Bitcoin", kind: "crypto", decimals: 8, symbol: "₿", logo: "/logos/crypto/btc.svg" },
  ETH: { code: "ETH", name: "Ethereum", kind: "crypto", decimals: 8, symbol: "Ξ", logo: "/logos/crypto/eth.svg" },
  USDT: { code: "USDT", name: "Tether", kind: "crypto", decimals: 6, symbol: "₮", logo: "/logos/crypto/usdt.svg" },
  USDC: { code: "USDC", name: "USD Coin", kind: "crypto", decimals: 6, symbol: "$", logo: "/logos/crypto/usdc.svg" },
  SOL: { code: "SOL", name: "Solana", kind: "crypto", decimals: 8, symbol: "◎", logo: "/logos/crypto/sol.svg" },
};

/**
 * Currencies added from the admin panel (Currencies → Add a currency) are not in the list above.
 * The server learns them from GET /currencies (repo.ts primes this before every read), so their
 * amounts are converted with THEIR decimal places. In the browser this stays empty and a new
 * currency falls back to its code and 2 dp.
 */
const LEARNED = new Map<string, AssetInfo>();
export function rememberAssets(list: AssetInfo[]) {
  for (const a of list) if (!(a.code in ASSETS)) LEARNED.set(a.code, a);
}

/** Safe lookup: an asset the backend adds later still renders (plain code, 2 dp). */
export const assetInfo = (code: string): AssetInfo =>
  ASSETS[code as AssetCode] ?? LEARNED.get(code) ?? { code: code as AssetCode, name: code, kind: "fiat", decimals: 2, symbol: code };
export const assetFace = (code: string) => ASSET_FACE[code as AssetCode] ?? { bg: "var(--color-ink-700)", fg: "#fff" };

export const ASSET_CODES = Object.keys(ASSETS) as AssetCode[];

export const NETWORKS: Partial<Record<AssetCode, string[]>> = {
  USDT: ["trc20", "bep20", "erc20"],
  BTC: ["btc", "lightning"],
  ETH: ["erc20", "base"],
  USDC: ["sol", "base"],
  SOL: ["sol"],
};

export const TIER_LIMITS: Record<number, { daily: string; balance: string }> = {
  0: { daily: "₦50,000", balance: "₦300,000" },
  1: { daily: "₦1,000,000", balance: "₦5,000,000" },
  2: { daily: "₦5,000,000", balance: "Unlimited" },
  3: { daily: "₦25,000,000", balance: "Unlimited" },
};

export const CHECK_LABEL: Record<string, string> = {
  bvn: "BVN",
  dob: "Date of birth",
  nin: "NIN",
  liveness: "Selfie liveness",
  id_document: "ID document",
  document: "ID document",
  address: "Home address",
};
export const checkLabel = (c: string) => CHECK_LABEL[c] ?? c.replace(/_/g, " ");

/** What a tier's request asks for, e.g. "Tier 2 · NIN + selfie". */
export const KYC_TIER_TITLE: Record<number, string> = { 1: "Tier 1 · BVN + date of birth", 2: "Tier 2 · NIN + selfie", 3: "Tier 3 · ID document + address" };
export const kycTierTitle = (tier: number) => KYC_TIER_TITLE[tier] ?? `Tier ${tier}`;

/** "2nd try", "3rd try"… (attempt 1 has no label). */
export const attemptLabel = (n: number) => (n <= 1 ? "" : `${n}${n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : n % 10 === 1 && n % 100 !== 11 ? "st" : "th"} try`);

export const CATEGORIES: { id: TxCategory; label: string; short: string }[] = [
  { id: "currency", label: "Currency", short: "Currency" },
  { id: "virtual_card", label: "Virtual cards", short: "Cards" },
  { id: "cashpoint", label: "Cashpoints", short: "Cashpoints" },
  { id: "utility", label: "Utilities", short: "Utilities" },
  { id: "giftcard", label: "Gift cards", short: "Gift cards" },
];
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c;

/** Backend transaction types (transactions.type and transaction_fees.transaction_type). */
export const TX_TYPES: { type: string; category: TxCategory; label: string }[] = [
  { type: "swap", category: "currency", label: "Swap" },
  { type: "deposit", category: "currency", label: "Deposit" },
  { type: "send", category: "currency", label: "Send" },
  { type: "send_external", category: "currency", label: "Send (bank / wallet)" },
  { type: "send_tribe", category: "currency", label: "Send (Tribe user)" },
  { type: "receive", category: "currency", label: "Receive" },
  { type: "referral_withdraw", category: "currency", label: "Referral withdrawal" },
  { type: "card_create", category: "virtual_card", label: "Card creation" },
  { type: "card_fund", category: "virtual_card", label: "Card funding" },
  { type: "card_withdraw", category: "virtual_card", label: "Card withdrawal" },
  { type: "card_delete", category: "virtual_card", label: "Card deleted" },
  { type: "cashpoint_create", category: "cashpoint", label: "Cashpoint generated" },
  { type: "cashpoint_redeem", category: "cashpoint", label: "Cashpoint redeemed" },
  { type: "cashpoint_cancel", category: "cashpoint", label: "Cashpoint cancelled" },
  { type: "bill", category: "utility", label: "Bill payment" },
  { type: "gift_buy", category: "giftcard", label: "Gift card buy" },
  { type: "gift_sell", category: "giftcard", label: "Gift card sell" },
];
export const typeLabel = (t: string) => TX_TYPES.find((x) => x.type === t)?.label ?? t.replace(/_/g, " ");
export const typesFor = (c: TxCategory) => TX_TYPES.filter((t) => t.category === c);

export const CUSTOMER_LABELS = ["VIP", "watchlist", "high-risk", "merchant", "creator", "early-adopter", "chargeback-risk", "diaspora"];
