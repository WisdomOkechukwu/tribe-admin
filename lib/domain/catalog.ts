import type { AssetCode, TxCategory, TxType } from "./types";

// Prices and catalogs mirror tribe-mobile/src/data/{assets,catalog}.ts. All rates are illustrative.

export type AssetInfo = { code: AssetCode; name: string; kind: "crypto" | "fiat"; usd: number; decimals: number; symbol: string; logo?: string };

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

export const ASSETS: Record<AssetCode, AssetInfo> = {
  NGN: { code: "NGN", name: "Naira", kind: "fiat", usd: 1 / 1540, decimals: 2, symbol: "₦", logo: "/logos/flags/ng.svg" },
  USD: { code: "USD", name: "US Dollar", kind: "fiat", usd: 1, decimals: 2, symbol: "$", logo: "/logos/flags/us.svg" },
  GBP: { code: "GBP", name: "British Pound", kind: "fiat", usd: 1.31, decimals: 2, symbol: "£", logo: "/logos/flags/gb.svg" },
  EUR: { code: "EUR", name: "Euro", kind: "fiat", usd: 1.12, decimals: 2, symbol: "€", logo: "/logos/flags/eu.svg" },
  KES: { code: "KES", name: "Kenyan Shilling", kind: "fiat", usd: 1 / 129, decimals: 2, symbol: "KSh", logo: "/logos/flags/ke.svg" },
  GHS: { code: "GHS", name: "Ghana Cedi", kind: "fiat", usd: 1 / 15.4, decimals: 2, symbol: "₵", logo: "/logos/flags/gh.svg" },
  CAD: { code: "CAD", name: "Canadian Dollar", kind: "fiat", usd: 0.73, decimals: 2, symbol: "C$", logo: "/logos/flags/ca.svg" },
  BTC: { code: "BTC", name: "Bitcoin", kind: "crypto", usd: 98_400, decimals: 8, symbol: "₿", logo: "/logos/crypto/btc.svg" },
  ETH: { code: "ETH", name: "Ethereum", kind: "crypto", usd: 3_620, decimals: 6, symbol: "Ξ", logo: "/logos/crypto/eth.svg" },
  USDT: { code: "USDT", name: "Tether", kind: "crypto", usd: 1, decimals: 2, symbol: "₮", logo: "/logos/crypto/usdt.svg" },
  USDC: { code: "USDC", name: "USD Coin", kind: "crypto", usd: 1, decimals: 2, symbol: "$", logo: "/logos/crypto/usdc.svg" },
  SOL: { code: "SOL", name: "Solana", kind: "crypto", usd: 182, decimals: 4, symbol: "◎", logo: "/logos/crypto/sol.svg" },
};

export const ASSET_CODES = Object.keys(ASSETS) as AssetCode[];
export const FIAT: AssetCode[] = ["NGN", "USD", "GBP", "EUR", "KES", "GHS", "CAD"];
export const CRYPTO: AssetCode[] = ["BTC", "ETH", "USDT", "USDC", "SOL"];

export const NETWORKS: Partial<Record<AssetCode, string[]>> = {
  USDT: ["trc20", "bep20", "erc20"],
  BTC: ["btc", "lightning"],
  ETH: ["erc20", "base"],
  USDC: ["sol", "base"],
  SOL: ["sol"],
};

export const round = (asset: AssetCode, n: number) => {
  const f = 10 ** ASSETS[asset].decimals;
  return Math.round(n * f) / f;
};

/** Mid-market rate: how many `to` per 1 `from`. */
export const midRate = (from: AssetCode, to: AssetCode) => ASSETS[from].usd / ASSETS[to].usd;

export const toUsd = (asset: AssetCode, amount: number) => amount * ASSETS[asset].usd;
export const toNgn = (asset: AssetCode, amount: number) => amount * midRate(asset, "NGN");

export const TIER_LIMITS: Record<number, { daily: string; balance: string }> = {
  0: { daily: "₦50,000", balance: "₦300,000" },
  1: { daily: "₦1,000,000", balance: "₦5,000,000" },
  2: { daily: "₦5,000,000", balance: "Unlimited" },
  3: { daily: "₦25,000,000", balance: "Unlimited" },
};

export const TIER_CHECKS = {
  1: ["bvn", "dob"],
  2: ["nin", "liveness"],
  3: ["id_document", "address"],
} as const;

export const CHECK_LABEL: Record<string, string> = {
  bvn: "BVN",
  dob: "Date of birth",
  nin: "NIN",
  liveness: "Selfie liveness",
  id_document: "ID document",
  address: "Home address",
};

export type Biller = { id: string; name: string; category: "airtime" | "data" | "tv" | "electricity"; plans?: { id: string; name: string; price: number }[] };

export const BILLERS: Biller[] = [
  { id: "mtn", name: "MTN", category: "data", plans: [{ id: "mtn-1gb", name: "1GB · 7 days", price: 800 }, { id: "mtn-10gb", name: "10GB · 30 days", price: 3_500 }, { id: "mtn-40gb", name: "40GB · 30 days", price: 11_000 }] },
  { id: "airtel", name: "Airtel", category: "airtime" },
  { id: "glo", name: "Glo", category: "data", plans: [{ id: "glo-5gb", name: "5.8GB · 30 days", price: 2_000 }] },
  { id: "9mobile", name: "9mobile", category: "airtime" },
  { id: "dstv", name: "DStv", category: "tv", plans: [{ id: "dstv-compact", name: "Compact", price: 15_700 }, { id: "dstv-premium", name: "Premium", price: 37_000 }] },
  { id: "gotv", name: "GOtv", category: "tv", plans: [{ id: "gotv-max", name: "Max", price: 7_200 }] },
  { id: "phed", name: "PHED", category: "electricity" },
];

export const billerName = (id?: string) => BILLERS.find((b) => b.id === id)?.name ?? id ?? "—";

export const GIFT_BRANDS = [
  { id: "steam", name: "Steam", sellRate: 1_210 },
  { id: "apple", name: "Apple", sellRate: 1_240 },
  { id: "playstation", name: "PlayStation", sellRate: 1_160 },
  { id: "amazon", name: "Amazon", sellRate: 1_180 },
  { id: "spotify", name: "Spotify", sellRate: 1_020 },
  { id: "netflix", name: "Netflix", sellRate: 1_050 },
  { id: "xbox", name: "Xbox", sellRate: 1_130 },
  { id: "googleplay", name: "Google Play", sellRate: 1_000 },
  { id: "ebay", name: "eBay", sellRate: 1_090 },
  { id: "nike", name: "Nike", sellRate: 1_070 },
  { id: "roblox", name: "Roblox", sellRate: 1_100 },
  { id: "target", name: "Target", sellRate: 1_040 },
];
export const giftName = (id?: string) => GIFT_BRANDS.find((b) => b.id === id)?.name ?? id ?? "—";
export const GIFT_AMOUNTS = [10, 25, 50, 100, 200];
export const NGN_PER_KWH = 438.6;

export const CATEGORIES: { id: TxCategory; label: string; short: string }[] = [
  { id: "currency", label: "Currency", short: "Currency" },
  { id: "virtual_card", label: "Virtual cards", short: "Cards" },
  { id: "cashpoint", label: "Cashpoints", short: "Cashpoints" },
  { id: "utility", label: "Utilities", short: "Utilities" },
  { id: "giftcard", label: "Gift cards", short: "Gift cards" },
];
export const categoryLabel = (c: TxCategory) => CATEGORIES.find((x) => x.id === c)?.label ?? c;

export const TX_TYPES: { type: TxType; category: TxCategory; label: string }[] = [
  { type: "swap", category: "currency", label: "Swap" },
  { type: "deposit", category: "currency", label: "Deposit" },
  { type: "withdrawal", category: "currency", label: "Withdrawal" },
  { type: "send", category: "currency", label: "Send" },
  { type: "receive", category: "currency", label: "Receive" },
  { type: "card_create", category: "virtual_card", label: "Card creation" },
  { type: "card_fund", category: "virtual_card", label: "Card funding" },
  { type: "card_spend", category: "virtual_card", label: "Card spend" },
  { type: "card_withdraw", category: "virtual_card", label: "Card withdrawal" },
  { type: "card_refund", category: "virtual_card", label: "Card refund" },
  { type: "card_chargeback", category: "virtual_card", label: "Chargeback" },
  { type: "cashpoint_create", category: "cashpoint", label: "Cashpoint generated" },
  { type: "cashpoint_redeem", category: "cashpoint", label: "Cashpoint redeemed" },
  { type: "cashpoint_cancel", category: "cashpoint", label: "Cashpoint cancelled" },
  { type: "airtime", category: "utility", label: "Airtime" },
  { type: "data", category: "utility", label: "Data" },
  { type: "tv", category: "utility", label: "TV" },
  { type: "electricity", category: "utility", label: "Electricity" },
  { type: "giftcard_buy", category: "giftcard", label: "Gift card buy" },
  { type: "giftcard_sell", category: "giftcard", label: "Gift card sell" },
];
export const typeLabel = (t: TxType) => TX_TYPES.find((x) => x.type === t)?.label ?? t;
export const typesFor = (c: TxCategory) => TX_TYPES.filter((t) => t.category === c);

export const CUSTOMER_LABELS = ["VIP", "watchlist", "high-risk", "merchant", "creator", "early-adopter", "chargeback-risk", "diaspora"];


// ─────────────────────────────────────────────────────────────────────────────
// Inventory model
// NGN is held in separate "books" per desk/product. Every conversion goes
// through the desk's book: BTC → Crypto NGN, Fiat NGN → GBP. Products pay out
// of their own book: Utilities NGN → airtime, Gift card NGN → card codes.
// Non-NGN assets sit in asset pools (crypto custody, FX accounts).
// ─────────────────────────────────────────────────────────────────────────────
export const BOOKS = [
  { id: "local-ngn", label: "Local NGN", purpose: "Customers' naira: deposits in, withdrawals & bank sends out", balance: 4_200_000_000, low: 400_000_000, topup: true, icon: "customers" },
  { id: "fiat-ngn", label: "Fiat NGN", purpose: "FX desk: USD, GBP, EUR, CAD, KES, GHS conversions", balance: 950_000_000, low: 100_000_000, topup: true, icon: "coins" },
  { id: "crypto-ngn", label: "Crypto NGN", purpose: "Crypto desk: BTC, ETH, USDT, USDC, SOL conversions", balance: 1_200_000_000, low: 120_000_000, topup: true, icon: "inventory" },
  { id: "card-ngn", label: "Virtual card NGN", purpose: "Funds virtual card loads; card unloads land here", balance: 320_000_000, low: 40_000_000, topup: true, icon: "legs" },
  { id: "utilities-ngn", label: "Utilities NGN", purpose: "Pays billers: airtime, data, TV, PHED electricity", balance: 95_000_000, low: 20_000_000, topup: true, icon: "alert" },
  { id: "giftcard-ngn", label: "Gift card NGN", purpose: "Buys gift card codes; card redemptions land here", balance: 240_000_000, low: 30_000_000, topup: true, icon: "ticket" },
  { id: "cashpoint-ngn", label: "Cashpoint NGN", purpose: "Escrow for open cashpoint codes: system-managed, no top-ups", balance: 0, low: 0, topup: false, icon: "lock" },
] as const;
export type BookId = (typeof BOOKS)[number]["id"];
export const LOCAL_NGN: BookId = "local-ngn";
export const bookLabel = (id: string) => BOOKS.find((b) => b.id === id)?.label ?? id;
export const isBook = (id: string) => BOOKS.some((b) => b.id === id);
/** The desk whose NGN book converts this asset. */
export const deskBook = (asset: AssetCode): BookId => (ASSETS[asset].kind === "crypto" ? "crypto-ngn" : "fiat-ngn");

export const PROVIDERS = [
  { id: "crypto", name: "Crypto wallet", purpose: "Crypto wallets" },
  { id: "global-fx", name: "Global FX partner", purpose: "Foreign currency accounts" },
  { id: "africa-rails", name: "Africa rails", purpose: "KES & GHS mobile money" },
] as const;

export const POOL_SEED: { providerId: (typeof PROVIDERS)[number]["id"]; asset: AssetCode; balance: number; low: number }[] = [
  { providerId: "crypto", asset: "BTC", balance: 42.5, low: 5 },
  { providerId: "crypto", asset: "ETH", balance: 610, low: 60 },
  { providerId: "crypto", asset: "USDT", balance: 2_400_000, low: 250_000 },
  { providerId: "crypto", asset: "USDC", balance: 1_150_000, low: 150_000 },
  { providerId: "crypto", asset: "SOL", balance: 9_800, low: 1_000 },
  { providerId: "global-fx", asset: "USD", balance: 1_900_000, low: 200_000 },
  { providerId: "global-fx", asset: "GBP", balance: 640_000, low: 80_000 },
  { providerId: "global-fx", asset: "EUR", balance: 720_000, low: 80_000 },
  { providerId: "global-fx", asset: "CAD", balance: 210_000, low: 30_000 },
  { providerId: "africa-rails", asset: "KES", balance: 38_000_000, low: 5_000_000 },
  { providerId: "africa-rails", asset: "GHS", balance: 2_600_000, low: 400_000 },
];

export const poolId = (providerId: string, asset: AssetCode) => `${providerId}:${asset}`;

/** Where an asset physically sits: NGN → Local NGN book, others → their asset pool. */
export const settlementPool = (asset: AssetCode) => {
  if (asset === "NGN") return LOCAL_NGN;
  if (ASSETS[asset].kind === "crypto") return poolId("crypto", asset);
  if (asset === "KES" || asset === "GHS") return poolId("africa-rails", asset);
  return poolId("global-fx", asset);
};

// Top-ups: naira added straight to an NGN book (all books except Cashpoint NGN).
export const TOPUP_POOLS: string[] = BOOKS.filter((b) => b.topup).map((b) => b.id);

/** A step in a transaction's route: an asset, an NGN book, or an outside product/party. */
export type RouteStep = { t: "asset"; asset: AssetCode } | { t: "book"; id: string } | { t: "end"; label: string };
