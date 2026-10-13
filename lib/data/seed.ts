import {
  ASSETS, BILLERS, BOOKS, CRYPTO, CUSTOMER_LABELS, GIFT_AMOUNTS, GIFT_BRANDS, LOCAL_NGN, NETWORKS, NGN_PER_KWH, POOL_SEED, PROVIDERS,
  TX_TYPES, TIER_CHECKS, bookLabel, deskBook, midRate, poolId, round, settlementPool, toNgn, toUsd, type RouteStep,
} from "@/lib/domain/catalog";
import { ADMINS } from "@/lib/domain/admins";
import type {
  ApiRequest, AssetCode, AuditEvent, BalanceMovement, Customer, KycMedia, SupportThread, HttpMethod, InventoryEntry, InventoryMovement, InventoryPool, KycTier,
  Leg, MarkupRule, Money, Transaction, TxStatus, TxType, Verification, VirtualCard,
} from "@/lib/domain/types";
import { makeRng } from "./prng";

/** Fixed "now" for the dataset. Never call Date.now() while seeding. */
export const SEED_NOW = Date.parse("2026-10-13T08:00:00.000Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

export type Db = {
  customers: Customer[];
  customerById: Map<string, Customer>;
  verifications: Verification[];
  transactions: Transaction[]; // newest first
  txById: Map<string, Transaction>;
  txByCustomer: Map<string, Transaction[]>; // newest first
  pools: InventoryPool[];
  poolById: Map<string, InventoryPool>;
  entries: InventoryEntry[]; // newest first
  markups: MarkupRule[];
  api: ApiRequest[]; // newest first
  apiByCustomer: Map<string, ApiRequest[]>;
  apiByTx: Map<string, ApiRequest[]>;
  audit: AuditEvent[]; // newest first
  threads: SupportThread[];
  activity: number;
  seq: number;
};

const FIRST = ["Ada", "Chinedu", "Ngozi", "Emeka", "Funke", "Tobi", "Kemi", "Ifeanyi", "Bola", "Yusuf", "Aisha", "Segun", "Tolu", "Chioma", "Obinna", "Halima", "Femi", "Zainab", "Uche", "Dami", "Ebuka", "Nneka", "Kunle", "Amara", "Ife", "Somto", "Kelechi", "Fatima", "Wale", "Ronke", "Kwame", "Akosua", "Wanjiru", "Otieno", "Amina", "Kofi", "Efua", "Baraka", "Nia", "Jide"];
const LAST = ["Okafor", "Adeyemi", "Okonkwo", "Balogun", "Eze", "Ibrahim", "Bello", "Nwosu", "Adebayo", "Olawale", "Chukwu", "Abubakar", "Afolabi", "Okeke", "Danjuma", "Lawal", "Ogunleye", "Nnamdi", "Mensah", "Owusu", "Kamau", "Odhiambo", "Asante", "Mwangi", "Boateng", "Udeh", "Ojo", "Salami", "Akande", "Uzor"];
const DOMAINS = ["gmail.com", "gmail.com", "gmail.com", "yahoo.com", "outlook.com", "icloud.com", "proton.me"];
const CITIES = ["Lekki, Lagos", "Yaba, Lagos", "Ikeja, Lagos", "Wuse 2, Abuja", "GRA, Port Harcourt", "Enugu", "Ibadan", "Benin City", "Kano", "Uyo", "Accra", "Nairobi", "London", "Houston"];
const BANKS = ["GTBank", "Access Bank", "Kuda", "OPay", "Moniepoint", "Zenith Bank", "First Bank", "UBA", "Wema Bank"];
const MERCHANTS = ["Netflix", "Spotify", "Amazon", "Apple", "Uber", "Google", "AliExpress", "Steam", "Canva", "OpenAI", "Bolt", "Airbnb"];
const DEVICES = [
  ["iPhone 15 Pro", "iOS 18.2"], ["iPhone 13", "iOS 17.6"], ["Samsung Galaxy S24", "Android 15"], ["Tecno Camon 30", "Android 14"],
  ["Infinix Note 40", "Android 14"], ["Pixel 8", "Android 15"], ["Redmi Note 13", "Android 14"], ["web.tribe.africa", "Chrome 129"],
] as const;
const CHANNELS: Partial<Record<AssetCode, string>> = { NGN: "ngn-bank", USD: "ach", GBP: "fps", EUR: "sepa", CAD: "interac", KES: "momo", GHS: "momo" };

/**
 * Markup defaults per transaction type (illustrative): ratePct and feePct apply
 * to EVERY conversion leg (fee is % of that leg's from-asset); flatFee is charged
 * once per transaction.
 */
const MARKUP_DEFAULTS: Record<TxType, [ratePct: number, feePct: number, flat: number, flatAsset: AssetCode, active: boolean]> = {
  swap: [1, 0.1, 0, "NGN", true],
  deposit: [1, 0.1, 0, "NGN", true],
  withdrawal: [1, 0.1, 50, "NGN", true],
  send: [1, 0.1, 25, "NGN", true],
  receive: [1, 0.1, 0, "NGN", true],
  card_create: [1, 0.1, 1, "USD", true],
  card_fund: [1, 0.1, 0, "USD", true],
  card_spend: [1, 0.1, 0, "USD", true],
  card_withdraw: [1, 0.1, 0, "USD", true],
  card_refund: [1, 0.1, 0, "USD", true],
  card_chargeback: [1, 0.1, 0, "USD", true],
  cashpoint_create: [1, 0.1, 50, "NGN", true],
  cashpoint_redeem: [1, 0.1, 0, "NGN", true],
  cashpoint_cancel: [1, 0.1, 0, "NGN", true],
  airtime: [1, 0.1, 0, "NGN", true],
  data: [1, 0.1, 0, "NGN", true],
  tv: [1, 0.1, 100, "NGN", true],
  electricity: [1, 0.1, 100, "NGN", true],
  giftcard_buy: [1, 0.1, 0, "USD", true],
  giftcard_sell: [1, 0.1, 0, "USD", true],
};

const TYPE_WEIGHTS: [TxType, number][] = [
  ["swap", 14], ["deposit", 10], ["withdrawal", 6], ["send", 10], ["receive", 8],
  ["card_fund", 6], ["card_spend", 9], ["card_withdraw", 1.5], ["card_refund", 0.6], ["card_chargeback", 0.2], ["card_create", 0.8],
  ["cashpoint_create", 5], ["airtime", 7], ["data", 6], ["tv", 3], ["electricity", 5], ["giftcard_buy", 4], ["giftcard_sell", 5],
];

const CATEGORY_OF = Object.fromEntries(TX_TYPES.map((t) => [t.type, t.category])) as Record<TxType, Transaction["category"]>;

export function buildDb(): Db {
  const rng = makeRng(20261013);
  const id = (prefix: string) => `${prefix}_${rng.alnum(10).toLowerCase()}`;

  // ── Markups ──────────────────────────────────────────────
  const markups: MarkupRule[] = TX_TYPES.map(({ type, category }) => {
    const [ratePct, feePct, flatFee, flatFeeAsset, active] = MARKUP_DEFAULTS[type];
    return { txType: type, category, ratePct, feePct, flatFee, flatFeeAsset, active, updatedAt: iso(SEED_NOW - 21 * DAY), updatedBy: "adm_super" };
  });
  const rule = (t: TxType) => markups.find((m) => m.txType === t)!;
  /** Per-conversion-leg markup: { rate %, fee % of the from-asset } (0 when the rule is off). */
  const convOf = (t: TxType) => (rule(t).active ? { rate: rule(t).ratePct, fee: rule(t).feePct } : { rate: 0, fee: 0 });
  /** Flat per-transaction fee, in the given asset. */
  const flatOf = (t: TxType, asset: AssetCode) => {
    const r = rule(t);
    return r.active && r.flatFee ? round(asset, r.flatFee * midRate(r.flatFeeAsset, asset)) : 0;
  };

  // ── Inventory pools ──────────────────────────────────────
  const providerName = (pid: string) => PROVIDERS.find((p) => p.id === pid)!;
  const pools: InventoryPool[] = [
    ...BOOKS.map((b): InventoryPool => ({
      id: b.id, kind: "book", label: b.label, topup: b.topup, providerId: "tribe", provider: b.label, purpose: b.purpose,
      asset: "NGN", balance: b.balance, lowThreshold: b.low, updatedAt: iso(SEED_NOW - 90 * DAY),
    })),
    ...POOL_SEED.map((p): InventoryPool => ({
      // Crypto pools are named by the coin only (e.g. "BTC"); fiat pools by account + currency.
      id: poolId(p.providerId, p.asset), kind: "asset", label: p.providerId === "crypto" ? p.asset : `${providerName(p.providerId).name} · ${p.asset}`, topup: false,
      providerId: p.providerId, provider: providerName(p.providerId).name, purpose: providerName(p.providerId).purpose,
      asset: p.asset, balance: p.balance, lowThreshold: p.low, updatedAt: iso(SEED_NOW - 90 * DAY),
    })),
  ];
  const poolById = new Map(pools.map((p) => [p.id, p]));
  const entries: InventoryEntry[] = [];
  const audit: AuditEvent[] = [];

  const topUp = (pool: InventoryPool, amount: number, at: number, adminId = "adm_ops", note = pool.kind === "book" ? "Scheduled NGN top-up" : "Provider settlement") => {
    const before = pool.balance;
    pool.balance = round(pool.asset, before + amount);
    pool.updatedAt = iso(at);
    const ref = `TOP-${rng.alnum(8)}`;
    entries.push({ id: id("inv"), poolId: pool.id, kind: "topup", delta: amount, before, after: pool.balance, externalRef: ref, note, adminId, at: iso(at) });
    const admin = ADMINS.find((a) => a.id === adminId)!;
    audit.push({ id: id("aud"), adminId, adminName: admin.name, action: "inventory.topup", target: pool.id, summary: `${pool.label} updated +${amount} ${pool.asset}`, before: String(before), after: String(pool.balance), at: iso(at) });
  };

  const move = (pid: string, delta: number, txId: string, at: number): InventoryMovement => {
    const pool = poolById.get(pid)!;
    delta = round(pool.asset, delta);
    // Keep pools solvent: ops tops up before a pool would dip under half its threshold.
    if (delta < 0 && pool.balance + delta < pool.lowThreshold * 0.5) {
      const amt = round(pool.asset, Math.max(pool.lowThreshold * 4, -delta * 2));
      topUp(pool, amt, at - 5 * MIN);
    }
    const before = pool.balance;
    pool.balance = round(pool.asset, before + delta);
    pool.updatedAt = iso(at);
    entries.push({ id: id("inv"), poolId: pid, kind: delta < 0 ? "deduction" : "credit", delta, before, after: pool.balance, txId, at: iso(at) });
    return { poolId: pid, delta, before, after: pool.balance };
  };

  // ── Customers ────────────────────────────────────────────
  const customers: Customer[] = [];
  const verifications: Verification[] = [];
  const N = 420;
  const usedTags = new Set<string>();

  for (let i = 0; i < N; i++) {
    const ada = i === 0;
    const first = ada ? "Ada" : rng.pick(FIRST);
    const last = ada ? "Okafor" : rng.pick(LAST);
    let tag = ada ? "ada" : `${first.toLowerCase()}${rng.chance(0.5) ? last.toLowerCase().slice(0, 3) : ""}${rng.chance(0.6) ? rng.int(1, 99) : ""}`;
    while (usedTags.has(tag)) tag = `${tag}${rng.int(0, 9)}`;
    usedTags.add(tag);
    const email = ada ? "ada@tribe.africa" : `${first.toLowerCase()}.${last.toLowerCase()}${rng.chance(0.5) ? rng.int(1, 999) : ""}@${rng.pick(DOMAINS)}`;
    const country = ada ? "NG" : rng.weighted([["NG", 80], ["GH", 6], ["KE", 6], ["GB", 5], ["US", 3]] as const);
    const createdAt = ada ? SEED_NOW - 400 * DAY : SEED_NOW - Math.floor((rng.next() ** 1.7) * 540) * DAY - rng.int(1, DAY);
    const kycTier = (ada ? 3 : rng.weighted([[3, 40], [2, 25], [1, 20], [0, 15]] as const)) as KycTier;
    const kycRoll = rng.next();
    const kycStatus: Customer["kycStatus"] = ada ? "approved" : kycTier === 3 ? "approved" : kycRoll < 0.18 ? "pending" : kycRoll < 0.24 ? "failed" : kycTier === 0 ? "none" : "approved";

    const opened: AssetCode[] = ["NGN"];
    if (kycTier >= 1) opened.push(...rng.sample(["USDT", "BTC", "USDC"] as AssetCode[], rng.int(1, 3)));
    if (kycTier >= 3) opened.push(...rng.sample(["USD", "GBP", "EUR", "ETH", "SOL", "KES", "GHS", "CAD"] as AssetCode[], rng.int(1, 5)));
    if (ada) opened.splice(0, opened.length, "NGN", "USDT", "BTC", "ETH", "USD", "GBP", "EUR", "SOL");
    const uniqOpened = [...new Set(opened)];
    const balances: Partial<Record<AssetCode, number>> = {};
    for (const a of uniqOpened) balances[a] = round(a, rng.amount(5, 6_000) / ASSETS[a].usd);

    const devCount = rng.int(1, 3);
    const devices = Array.from({ length: devCount }, (_, d) => {
      const [name, os] = rng.pick(DEVICES);
      return { id: id("dev"), name, os, ip: `${rng.pick(["102.89", "197.210", "105.112", "41.184"])}.${rng.int(1, 254)}.${rng.int(1, 254)}`, lastActive: iso(SEED_NOW - rng.int(0, 20) * DAY - rng.int(0, DAY)), current: d === 0, trusted: rng.chance(0.85) };
    });

    const cards: VirtualCard[] = [];
    if (ada || (kycTier >= 2 && rng.chance(0.55))) {
      const cc = ada ? 1 : rng.int(1, 2);
      for (let c = 0; c < cc; c++) {
        cards.push({
          id: id("card"), label: ada ? "Everyday" : rng.pick(["Everyday", "Subscriptions", "Travel", "Shopping"]),
          network: rng.chance(0.5) ? "visa" : "mastercard", last4: ada ? "4821" : rng.digits(4), currency: "USD",
          balance: round("USD", rng.amount(0, 400)), frozen: rng.chance(0.08), monthlyLimit: rng.pick([500, 1000, 2500]),
          spentThisMonth: round("USD", rng.amount(0, 300)), createdAt: iso(createdAt + rng.int(5, 60) * DAY),
        });
      }
    }

    const cust: Customer = {
      id: ada ? "cus_ada0okafor" : id("cus"),
      firstName: first, lastName: last, tag, email,
      phone: ada ? "+234 803 555 0142" : country === "NG" ? `+234 ${rng.pick(["803", "806", "813", "816", "903", "806", "810", "701", "802", "905"])} ${rng.digits(3)} ${rng.digits(4)}` : `+${country === "GH" ? "233" : country === "KE" ? "254" : country === "GB" ? "44" : "1"} ${rng.digits(3)} ${rng.digits(3)} ${rng.digits(4)}`,
      country, dob: `${rng.int(1975, 2006)}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`,
      address: `${rng.int(1, 120)} ${rng.pick(["Admiralty Way", "Herbert Macaulay Way", "Allen Avenue", "Aminu Kano Crescent", "Trans-Amadi Road", "Ring Road", "Ozumba Mbadiwe"])}, ${rng.pick(CITIES)}`,
      createdAt: iso(createdAt), lastActiveAt: devices[0].lastActive,
      status: ada ? "active" : rng.weighted([["active", 94], ["frozen", 5], ["closed", 1]] as const),
      labels: ada ? ["early-adopter", "VIP"] : rng.chance(0.3) ? rng.sample(CUSTOMER_LABELS, rng.int(1, 2)) : [],
      kycTier, kycStatus,
      globalAccounts: kycTier >= 3 ? rng.weighted([["ready", 70], ["review", 10], ["none", 20]] as const) : "none",
      balances, opened: uniqOpened,
      security: { biometrics: rng.chance(0.7), twoFactor: rng.chance(0.45), pinSet: kycTier > 0 || rng.chance(0.5), lockFails: rng.chance(0.1) ? rng.int(1, 4) : 0 },
      devices,
      beneficiaries: Array.from({ length: rng.int(0, 5) }, () => {
        const kind = rng.weighted([["tribe", 4], ["bank", 4], ["wallet", 2]] as const);
        const asset: AssetCode = kind === "wallet" ? rng.pick(CRYPTO) : kind === "bank" ? rng.weighted([["NGN", 8], ["USD", 1], ["GBP", 1]] as const) : "NGN";
        return {
          id: id("ben"), kind, asset,
          name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
          handle: kind === "tribe" ? `@${rng.pick(FIRST).toLowerCase()}${rng.int(1, 99)}` : kind === "bank" ? `${rng.pick(BANKS)} •• ${rng.digits(4)}` : `${rng.hex(6)}…${rng.hex(4)}`,
          network: kind === "wallet" ? rng.pick(NETWORKS[asset] ?? ["—"]) : undefined,
        };
      }),
      cards,
      recurring: kycTier >= 1 && rng.chance(0.3)
        ? Array.from({ length: rng.int(1, 2) }, () => {
            const b = rng.pick(BILLERS);
            return {
              id: id("rec"), billerId: b.id, target: b.id === "phed" ? rng.digits(11) : b.category === "tv" ? rng.digits(10) : `080${rng.digits(8)}`,
              amountNgn: b.plans ? rng.pick(b.plans).price : rng.pick([1000, 2000, 5000, 10000]),
              payWith: rng.pick(uniqOpened), frequency: rng.pick(["weekly", "biweekly", "monthly"] as const),
              nextRun: iso(SEED_NOW + rng.int(1, 28) * DAY), active: rng.chance(0.85), lastPaid: iso(SEED_NOW - rng.int(1, 28) * DAY),
            };
          })
        : [],
      vault: [],
      referral: { code: `${tag.slice(0, 3).toUpperCase()}-${rng.alnum(3)}`, referredBy: rng.chance(0.3) ? `@${rng.pick(FIRST).toLowerCase()}` : undefined, invited: rng.int(0, 12), earning: 0, earnedNgn: 0 },
      tickets: [],
    };
    cust.referral.earning = Math.min(cust.referral.invited, rng.int(0, 6));
    cust.referral.earnedNgn = cust.referral.earning * 25 * rng.int(2, 40);
    customers.push(cust);

    // Verifications, tier by tier (QoreID).
    const reachedTier = kycStatus === "approved" ? kycTier : kycTier;
    for (let t = 1 as 1 | 2 | 3; t <= 3; t = (t + 1) as 1 | 2 | 3) {
      const approvedTier = t <= reachedTier;
      const nextTier = t === reachedTier + 1 && (kycStatus === "pending" || kycStatus === "failed");
      if (!approvedTier && !nextTier) break;
      const base = createdAt + (t - 1) * rng.int(1, 40) * DAY + rng.int(1, 6) * HOUR;
      const submitted = Math.min(base, SEED_NOW - rng.int(1, 72) * HOUR);
      TIER_CHECKS[t].forEach((check, k) => {
        let status: Verification["status"] = "approved";
        if (nextTier) status = kycStatus === "pending" ? "pending" : k === 0 ? "failed" : "approved";
        const doc =
          check === "bvn" ? { documentType: "BVN", documentMasked: `22${rng.digits(1)}•••••${rng.digits(4)}` }
          : check === "nin" ? { documentType: "NIN", documentMasked: `•••••••${rng.digits(4)}` }
          : check === "id_document" ? (() => {
              const dt = rng.pick(["PASSPORT_NGA", "DRIVERS_LICENSE_NGA", "VOTERS_CARD_NGA", "NIN_SLIP_NGA"]);
              return { documentType: dt, documentMasked: `${rng.alnum(2)}••••${rng.digits(3)}` };
            })()
          : check === "address" ? { documentType: "Utility bill", documentMasked: cust.address }
          : check === "dob" ? { documentType: "Date of birth", documentMasked: cust.dob }
          : { documentType: "Selfie video" };
        const decided = status !== "pending";
        const mid = () => id("med");
        const media: KycMedia[] =
          check === "bvn" ? [{ id: mid(), kind: "bvn_photo", label: "BVN record photo (NIBSS)" }]
          : check === "nin" ? [{ id: mid(), kind: "nin_photo", label: "NIN record photo (NIMC)" }]
          : check === "liveness" ? [
              { id: mid(), kind: "selfie", label: "Selfie" },
              { id: mid(), kind: "liveness_frame", label: "Liveness frame · turn left" },
              { id: mid(), kind: "liveness_frame", label: "Liveness frame · blink" },
            ]
          : check === "id_document" ? [
              { id: mid(), kind: "id_front", label: "ID document · front" },
              ...(doc.documentType === "PASSPORT_NGA" ? [] : [{ id: mid(), kind: "id_back" as const, label: "ID document · back" }]),
            ]
          : check === "address" ? [{ id: mid(), kind: "proof_of_address", label: "Proof of address" }]
          : [];
        verifications.push({
          media,
          id: id("ver"), customerId: cust.id, tier: t, check, provider: "QoreID", reference: `QID-${rng.alnum(10)}`, status,
          ...doc,
          matchScore: check === "liveness" || check === "bvn" || check === "nin" ? (status === "failed" ? rng.int(32, 61) : rng.int(82, 99)) : undefined,
          submittedAt: iso(submitted + k * MIN),
          decidedAt: decided ? iso(submitted + k * MIN + rng.int(1, 40) * MIN) : undefined,
          decidedBy: decided ? (rng.chance(0.8) ? "QoreID (auto)" : rng.pick(ADMINS).name) : undefined,
          reason: status === "failed" ? rng.pick(["Name mismatch with BVN record", "Liveness check inconclusive", "Document image blurry", "Selfie does not match ID photo"]) : undefined,
        });
      });
    }
  }

  // Activity weights: a few power users, a long tail.
  const weights = customers.map((c, i) => (i === 0 ? 40 : c.status === "closed" ? 0.2 : (rng.next() ** 3) * 12 + 0.3));
  const cum: number[] = [];
  weights.reduce((s, w, i) => (cum[i] = s + w), 0);
  const pickCustomer = () => {
    const r = rng.next() * cum[cum.length - 1];
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return customers[lo];
  };

  // ── Transaction events ───────────────────────────────────
  type Ev = { at: number; type: TxType; cust: Customer; parent?: Ev; tx?: Transaction; outcome?: "redeem" | "cancel" | "open" };
  const events: Ev[] = [];
  const TX_N = 6200;
  for (let i = 0; i < TX_N; i++) {
    const at = SEED_NOW - Math.floor((rng.next() ** 1.35) * 90 * DAY) - rng.int(0, 30) * MIN;
    const cust = pickCustomer();
    if (Date.parse(cust.createdAt) > at) cust.createdAt = iso(at - rng.int(1, 48) * HOUR);
    let type = rng.weighted(TYPE_WEIGHTS);
    if (type.startsWith("card_") && type !== "card_create" && cust.cards.length === 0) type = "swap";
    if (cust.kycTier === 0 && ["swap", "card_create", "giftcard_buy", "withdrawal"].includes(type)) type = rng.pick(["airtime", "data", "receive"] as TxType[]);
    const ev: Ev = { at, type, cust };
    events.push(ev);
    if (type === "cashpoint_create") {
      const outcome = rng.weighted([["redeem", 62], ["cancel", 14], ["open", 24]] as const);
      ev.outcome = outcome;
      if (outcome !== "open") {
        const later = at + rng.int(10, 3 * 24 * 60) * MIN;
        if (later < SEED_NOW) events.push({ at: later, type: outcome === "redeem" ? "cashpoint_redeem" : "cashpoint_cancel", cust: outcome === "redeem" ? pickCustomer() : cust, parent: ev });
        else ev.outcome = "open";
      }
    }
  }
  // Ada's showcase swap: GBP → NGN → BTC.
  events.push({ at: SEED_NOW - 2 * HOUR - 17 * MIN, type: "swap", cust: customers[0] });
  events.sort((a, b) => a.at - b.at);

  // Scheduled manual top-ups, applied in time order alongside transactions.
  const topups = Array.from({ length: 36 }, () => {
    const pool = rng.pick(pools.filter((p) => p.topup));
    return { at: SEED_NOW - rng.int(1, 88) * DAY - rng.int(0, DAY), pool, amount: round(pool.asset, pool.lowThreshold * rng.pick([0.5, 1, 1.5, 2])), adminId: rng.pick(["adm_ops", "adm_ops", "adm_super"]), note: rng.pick(["Weekly NGN top-up", "Pre-weekend float", "Treasury rebalance", "Book rebalance"]) };
  }).sort((a, b) => a.at - b.at);
  let nextTopup = 0;

  const transactions: Transaction[] = [];
  const api: ApiRequest[] = [];
  const req = (r: Omit<ApiRequest, "id" | "requestId" | "ip" | "device"> & { cust?: Customer }) => {
    const dev = r.cust?.devices[0];
    const { cust, ...rest } = r;
    api.push({ id: id("req"), requestId: `req_${rng.hex(16)}`, ip: dev?.ip ?? `10.0.${rng.int(0, 9)}.${rng.int(1, 254)}`, device: dev ? `${dev.name} · ${dev.os}` : "server", ...rest, customerId: cust?.id ?? rest.customerId });
  };

  /** Pending customer balance change: [customerId, account, asset, delta, card?]. */
  type Bal = [string, "wallet" | "card", AssetCode, number, { id: string; last4: string }?];
  type Spec = Omit<Leg, "seq" | "status" | "at" | "inventory" | "balances"> & { moves?: [string, number][]; bal?: Bal[]; critical?: boolean; debit?: boolean };
  // Every customer balance change in chronological order; before/after filled in after the loop.
  const balanceLog: BalanceMovement[] = [];
  const cardById = new Map<string, VirtualCard>();
  for (const c of customers) for (const k of c.cards) cardById.set(k.id, k);

  const fiatOf = (c: Customer) => c.opened.filter((a) => ASSETS[a].kind === "fiat");
  const usdAmt = (asset: AssetCode, usd: number) => round(asset, usd / ASSETS[asset].usd);
  const A = (asset: AssetCode): RouteStep => ({ t: "asset", asset });
  const B = (id: string): RouteStep => ({ t: "book", id });
  const E = (label: string): RouteStep => ({ t: "end", label });

  for (const ev of events) {
    const { cust, type, at } = ev;
    while (nextTopup < topups.length && topups[nextTopup].at <= at) {
      const tp = topups[nextTopup++];
      topUp(tp.pool, tp.amount, tp.at, tp.adminId, tp.note);
    }
    const txId = id("tx");
    const reference = `TRB-${rng.alnum(6)}`;
    const cat = CATEGORY_OF[type];
    let status: TxStatus = rng.weighted([["completed", 88], ["pending", 4], ["failed", 6], ["reversed", 2]] as const);
    if (at > SEED_NOW - 30 * MIN && rng.chance(0.5)) status = "pending";
    if (["receive", "deposit", "card_refund", "card_chargeback", "cashpoint_cancel", "card_create"].includes(type) && status === "reversed") status = "completed";
    if (type === "cashpoint_redeem" || type === "cashpoint_cancel") status = "completed";
    if (cust.id === customers[0].id && at > SEED_NOW - 3 * HOUR) status = "completed";

    const specs: Spec[] = [];
    const route: RouteStep[] = [];
    let source: Money;
    let destination: Money | undefined;
    let revenueNgn = 0; // rate spread + fees, in NGN
    let feeInSource = 0; // all fees, expressed in the source asset (for display)
    let title = "";
    let direction: "in" | "out" = "out";
    const meta: Transaction["meta"] = {};
    let failureReason: string | undefined;
    const conv = convOf(type);
    const wallet = (asset: AssetCode, amount: number, sign: 1 | -1, label?: string, owner = cust.id): Spec => ({
      kind: sign < 0 ? "debit_wallet" : "credit_wallet", label: label ?? (sign < 0 ? `Debit ${asset} wallet` : `Credit ${asset} wallet`),
      ...(sign < 0 ? { from: { asset, amount } } : { to: { asset, amount } }), debit: sign < 0 && owner === cust.id,
      bal: [[owner, "wallet", asset, sign * amount]],
    });
    const cardBal = (card: VirtualCard, delta: number): Bal[] => [[cust.id, "card", "USD", delta, { id: card.id, last4: card.last4 }]];
    const flatLeg = (asset: AssetCode, amount: number): Spec | null => (amount > 0 ? { kind: "fee", label: "Flat fee", fee: { asset, amount } } : null);
    const push = (...s: (Spec | null)[]) => s.forEach((x) => x && specs.push(x));
    const fx = () => `FX-${rng.alnum(10)}`;

    /**
     * Sell a non-NGN asset into a desk NGN book: "BTC → Crypto NGN".
     * 0.1% fee off the from-asset, 1% off the rate. Asset pool −net, book +NGN.
     * `fromPool: null` when the asset isn't in a Tribe pool (e.g. a card balance or gift card).
     */
    const intoBook = (from: Money, book: string, opts: { fromPool?: string | null; base?: number; label?: string; bal?: Bal[] } = {}) => {
      const fee = round(from.asset, (from.amount * conv.fee) / 100);
      const net = round(from.asset, from.amount - fee);
      const base = opts.base ?? midRate(from.asset, "NGN");
      const applied = base * (1 - conv.rate / 100);
      const out = round("NGN", net * applied);
      revenueNgn += net * (base - applied) + fee * base;
      const fromPool = opts.fromPool === undefined ? settlementPool(from.asset) : opts.fromPool;
      const moves: [string, number][] = [];
      if (fromPool) moves.push([fromPool, -net]);
      moves.push([book, out]);
      const spec: Spec = {
        kind: "convert", label: opts.label ?? `Convert ${from.asset} → ${bookLabel(book)}`, from, to: { asset: "NGN", amount: out }, fee: fee > 0 ? { asset: from.asset, amount: fee } : undefined,
        baseRate: base, appliedRate: applied, rateMarkupPct: conv.rate, provider: bookLabel(book), providerRef: fx(), moves, bal: opts.bal,
      };
      return { spec, out };
    };
    /**
     * Buy a non-NGN asset out of a desk NGN book: "Fiat NGN → GBP".
     * 0.1% fee off the NGN, 1% off the rate. Book −net NGN, asset pool +out.
     * `toPool: null` when the asset leaves Tribe (card load, gift card code).
     */
    const outOfBook = (ngn: number, book: string, to: AssetCode, opts: { toPool?: string | null; base?: number; label?: string; bal?: Bal[] } = {}) => {
      const fee = round("NGN", (ngn * conv.fee) / 100);
      const net = round("NGN", ngn - fee);
      const base = opts.base ?? midRate("NGN", to);
      const applied = base * (1 - conv.rate / 100);
      const out = round(to, net * applied);
      revenueNgn += fee + toNgn(to, net * (base - applied));
      const toPool = opts.toPool === undefined ? settlementPool(to) : opts.toPool;
      const moves: [string, number][] = [[book, -net]];
      if (toPool) moves.push([toPool, out]);
      const spec: Spec = {
        kind: "convert", label: opts.label ?? `Convert ${bookLabel(book)} → ${to}`, from: { asset: "NGN", amount: ngn }, to: { asset: to, amount: out }, fee: fee > 0 ? { asset: "NGN", amount: fee } : undefined,
        baseRate: base, appliedRate: applied, rateMarkupPct: conv.rate, provider: bookLabel(book), providerRef: fx(), moves, bal: opts.bal,
      };
      return { spec, out };
    };
    /** Gross-up: how much `from` to charge so that, after the leg's fee and markup, `target` NGN comes out. */
    const grossToNgn = (from: AssetCode, targetNgn: number) => round(from, targetNgn / (midRate(from, "NGN") * (1 - conv.rate / 100)) / (1 - conv.fee / 100) + 10 ** -ASSETS[from].decimals);
    const pushRoute = (...steps: RouteStep[]) => {
      for (const st of steps) {
        const last = route[route.length - 1];
        if (last && last.t === st.t && JSON.stringify(last) === JSON.stringify(st)) continue; // no "Crypto NGN → Crypto NGN"
        route.push(st);
      }
    };

    switch (type) {
      case "swap": {
        // e.g. BTC → GBP:  BTC → Crypto NGN  ·  Fiat NGN → GBP
        const isAdaShow = cust.id === customers[0].id && at > SEED_NOW - 3 * HOUR;
        const from: AssetCode = isAdaShow ? "BTC" : rng.pick(cust.opened.length > 1 ? cust.opened : (["NGN", "USDT"] as AssetCode[]));
        let to: AssetCode = isAdaShow ? "GBP" : rng.pick([...CRYPTO, "NGN", "USD", "GBP"] as AssetCode[]);
        if (to === from) to = from === "NGN" ? "USDT" : "NGN";
        const amt = isAdaShow ? 0.0125 : usdAmt(from, rng.amount(10, 5_000));
        push(wallet(from, amt, -1));
        pushRoute(A(from));
        let ngn = amt;
        if (from !== "NGN") {
          const c = intoBook({ asset: from, amount: amt }, deskBook(from));
          c.spec.critical = true;
          push(c.spec);
          ngn = c.out;
          pushRoute(B(deskBook(from)));
        }
        let out = ngn;
        if (to !== "NGN") {
          const c = outOfBook(ngn, deskBook(to), to);
          if (from === "NGN") c.spec.critical = true;
          push(c.spec);
          out = c.out;
          pushRoute(B(deskBook(to)));
        }
        push(wallet(to, out, 1));
        pushRoute(A(to));
        source = { asset: from, amount: amt }; destination = { asset: to, amount: out };
        title = `${from} → ${to}`;
        break;
      }
      case "deposit": {
        direction = "in";
        const asset: AssetCode = rng.pick(cust.opened);
        const amt = usdAmt(asset, rng.amount(20, 8_000));
        const crypto = ASSETS[asset].kind === "crypto";
        if (crypto) meta.network = rng.pick(NETWORKS[asset] ?? ["—"]);
        else meta.channel = asset === "NGN" ? "NIP transfer" : CHANNELS[asset];
        const pool = settlementPool(asset);
        push(
          { kind: "provider_collect", label: crypto ? `On-chain receipt (${meta.network}) into ${poolById.get(pool)!.label}` : `Inbound ${meta.channel} into ${poolById.get(pool)!.label}`, to: { asset, amount: amt }, provider: crypto ? ASSETS[asset].name : poolById.get(pool)!.provider, providerRef: crypto ? `0x${rng.hex(12)}…` : `NIP-${rng.digits(12)}`, moves: [[pool, amt]], critical: true },
          wallet(asset, amt, 1),
        );
        pushRoute(E(crypto ? `On-chain (${meta.network})` : asset === "NGN" ? "Bank (NIP)" : `Bank (${meta.channel})`), asset === "NGN" ? B(LOCAL_NGN) : A(asset), A(asset));
        source = { asset, amount: amt }; destination = { asset, amount: amt };
        title = `${asset} deposit`;
        break;
      }
      case "withdrawal": {
        const asset: AssetCode = rng.pick(cust.opened);
        const amt = usdAmt(asset, rng.amount(20, 5_000));
        const f = flatOf("withdrawal", asset);
        const net = round(asset, amt - f);
        revenueNgn += toNgn(asset, f); feeInSource += f;
        const crypto = ASSETS[asset].kind === "crypto";
        const pool = settlementPool(asset);
        if (crypto) meta.network = rng.pick(NETWORKS[asset] ?? ["—"]);
        else { meta.channel = CHANNELS[asset]; meta.counterparty = `${rng.pick(BANKS)} •• ${rng.digits(4)}`; }
        push(wallet(asset, amt, -1), flatLeg(asset, f), { kind: "provider_payout", label: `${crypto ? `On-chain payout (${meta.network})` : `Payout via ${meta.channel}`} from ${poolById.get(pool)!.label}`, from: { asset, amount: net }, provider: crypto ? ASSETS[asset].name : poolById.get(pool)!.provider, providerRef: crypto ? `0x${rng.hex(12)}…` : `PO-${rng.alnum(10)}`, moves: [[pool, -net]], critical: true });
        pushRoute(A(asset), asset === "NGN" ? B(LOCAL_NGN) : A(asset), E(crypto ? `Wallet (${meta.network})` : meta.counterparty!));
        source = { asset, amount: amt }; destination = { asset, amount: net };
        title = crypto ? `${asset} withdrawal` : `Withdrawal to ${meta.counterparty}`;
        break;
      }
      case "send": {
        const toTribe = rng.chance(0.55);
        const asset: AssetCode = toTribe ? rng.pick(cust.opened) : rng.pick(fiatOf(cust));
        const amt = usdAmt(asset, rng.amount(3, 1_500));
        const f = toTribe ? 0 : flatOf("send", asset);
        const net = round(asset, amt - f);
        revenueNgn += toNgn(asset, f); feeInSource += f;
        if (toTribe) {
          const peer = pickCustomer();
          meta.counterparty = `@${peer.tag}`;
          push(wallet(asset, amt, -1), { ...wallet(asset, amt, 1, `Credit @${peer.tag}`, peer.id), provider: "Tribe ledger", critical: true });
          pushRoute(A(asset), E(`@${peer.tag}`));
          title = `To @${peer.tag}`;
        } else {
          const pool = settlementPool(asset);
          meta.channel = CHANNELS[asset];
          meta.counterparty = `${rng.pick(BANKS)} •• ${rng.digits(4)}`;
          push(wallet(asset, amt, -1), flatLeg(asset, f), { kind: "provider_payout", label: `Bank payout via ${meta.channel} from ${poolById.get(pool)!.label}`, from: { asset, amount: net }, provider: poolById.get(pool)!.provider, providerRef: `PO-${rng.alnum(10)}`, moves: [[pool, -net]], critical: true });
          pushRoute(A(asset), asset === "NGN" ? B(LOCAL_NGN) : A(asset), E(meta.counterparty));
          title = `To ${meta.counterparty}`;
        }
        source = { asset, amount: amt }; destination = { asset, amount: net };
        break;
      }
      case "receive": {
        direction = "in";
        const fromTribe = rng.chance(0.6);
        const asset: AssetCode = fromTribe ? rng.pick(cust.opened) : "NGN";
        const amt = usdAmt(asset, rng.amount(3, 1_200));
        if (fromTribe) {
          const peer = pickCustomer();
          meta.counterparty = `@${peer.tag}`;
          push({ ...wallet(asset, amt, -1, `Debit @${peer.tag}`, peer.id), provider: "Tribe ledger", critical: true }, wallet(asset, amt, 1));
          pushRoute(E(`@${peer.tag}`), A(asset));
          title = `From @${peer.tag}`;
        } else {
          meta.counterparty = `${rng.pick(FIRST)} ${rng.pick(LAST)} · ${rng.pick(BANKS)}`;
          meta.channel = "NIP transfer";
          push({ kind: "provider_collect", label: "Inbound NIP transfer into Local NGN", to: { asset, amount: amt }, provider: "Local NGN", providerRef: `NIP-${rng.digits(12)}`, moves: [[LOCAL_NGN, amt]], critical: true }, wallet(asset, amt, 1));
          pushRoute(E("Bank (NIP)"), B(LOCAL_NGN), A("NGN"));
          title = `From ${meta.counterparty}`;
        }
        source = { asset, amount: amt }; destination = { asset, amount: amt };
        break;
      }
      case "card_create": {
        const payWith: AssetCode = rng.pick(["USD", "NGN", "USDT"].filter((a) => cust.opened.includes(a as AssetCode)) as AssetCode[]) ?? "NGN";
        const amt = flatOf("card_create", payWith) || round(payWith, midRate("USD", payWith));
        const card = cust.cards[0];
        meta.cardId = card?.id; meta.cardLast4 = card?.last4 ?? rng.digits(4);
        revenueNgn += toNgn(payWith, amt); feeInSource += amt;
        push(wallet(payWith, amt, -1), flatLeg(payWith, amt), { kind: "provider_purchase", label: "Issue virtual card", provider: "Card issuer", providerRef: `CRD-${rng.alnum(10)}`, critical: true });
        pushRoute(A(payWith), E(`New card •• ${meta.cardLast4}`));
        source = { asset: payWith, amount: amt };
        title = `New card •• ${meta.cardLast4}`;
        break;
      }
      case "card_fund": {
        // e.g. GBP → Fiat NGN · Virtual card NGN → card USD
        const card = rng.pick(cust.cards);
        meta.cardId = card.id; meta.cardLast4 = card.last4;
        const payWith: AssetCode = rng.pick(cust.opened);
        const amt = usdAmt(payWith, rng.amount(5, 600));
        push(wallet(payWith, amt, -1));
        pushRoute(A(payWith));
        let ngn = amt;
        if (payWith !== "NGN") {
          const c = intoBook({ asset: payWith, amount: amt }, deskBook(payWith));
          c.spec.critical = true;
          push(c.spec);
          ngn = c.out;
          pushRoute(B(deskBook(payWith)));
        }
        const load = outOfBook(ngn, "card-ngn", "USD", { toPool: null, label: `Load card •• ${card.last4} from Virtual card NGN` });
        load.spec.kind = "card_load";
        load.spec.bal = cardBal(card, load.out);
        if (payWith === "NGN") load.spec.critical = true;
        push(load.spec);
        pushRoute(B("card-ngn"), E(`Card •• ${card.last4}`));
        source = { asset: payWith, amount: amt }; destination = { asset: "USD", amount: load.out };
        title = `Fund card •• ${card.last4}`;
        break;
      }
      case "card_spend": {
        const card = rng.pick(cust.cards);
        meta.cardId = card.id; meta.cardLast4 = card.last4; meta.merchant = rng.pick(MERCHANTS);
        const amt = round("USD", rng.amount(2, 250));
        push(
          { kind: "card_unload", label: `Authorisation · ${meta.merchant}`, from: { asset: "USD", amount: amt }, provider: "Card issuer", providerRef: `AUTH-${rng.digits(8)}`, bal: cardBal(card, -amt), critical: true },
          { kind: "provider_payout", label: "Merchant settlement (by card issuer)", from: { asset: "USD", amount: amt }, provider: "Card issuer", providerRef: `STL-${rng.alnum(10)}` },
        );
        pushRoute(E(`Card •• ${card.last4}`), E(meta.merchant));
        source = { asset: "USD", amount: amt };
        title = `${meta.merchant} · •• ${card.last4}`;
        break;
      }
      case "card_withdraw": {
        // Card USD → Virtual card NGN · Fiat NGN → USD
        direction = "in";
        const card = rng.pick(cust.cards);
        meta.cardId = card.id; meta.cardLast4 = card.last4;
        const amt = round("USD", rng.amount(5, 300));
        const un = intoBook({ asset: "USD", amount: amt }, "card-ngn", { fromPool: null, label: `Unload card •• ${card.last4} into Virtual card NGN`, bal: cardBal(card, -amt) });
        un.spec.kind = "card_unload";
        un.spec.critical = true;
        const buy = outOfBook(un.out, "fiat-ngn", "USD");
        push(un.spec, buy.spec, wallet("USD", buy.out, 1));
        pushRoute(E(`Card •• ${card.last4}`), B("card-ngn"), B("fiat-ngn"), A("USD"));
        source = { asset: "USD", amount: amt }; destination = { asset: "USD", amount: buy.out };
        title = `Card •• ${card.last4} to wallet`;
        break;
      }
      case "card_refund":
      case "card_chargeback": {
        direction = "in";
        const card = rng.pick(cust.cards);
        meta.cardId = card.id; meta.cardLast4 = card.last4; meta.merchant = rng.pick(MERCHANTS);
        const amt = round("USD", rng.amount(2, 120));
        push({ kind: "provider_collect", label: type === "card_refund" ? `Refund from ${meta.merchant}` : `Chargeback won vs ${meta.merchant}`, to: { asset: "USD", amount: amt }, provider: "Card issuer", providerRef: `${type === "card_refund" ? "RF" : "CB"}-${rng.alnum(10)}`, critical: true }, { kind: "card_load", label: `Credit card •• ${card.last4}`, to: { asset: "USD", amount: amt }, provider: "Card issuer", bal: cardBal(card, amt) });
        pushRoute(E(meta.merchant), E(`Card •• ${card.last4}`));
        source = { asset: "USD", amount: amt }; destination = { asset: "USD", amount: amt };
        title = `${type === "card_refund" ? "Refund" : "Chargeback"} · ${meta.merchant}`;
        break;
      }
      case "cashpoint_create": {
        const amt = rng.pick([2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 250_000]);
        const f = flatOf("cashpoint_create", "NGN");
        revenueNgn += f; feeInSource += f;
        meta.cashpointCode = rng.digits(12);
        push(wallet("NGN", amt + f, -1), flatLeg("NGN", f), { kind: "escrow_hold", label: "Hold in Cashpoint NGN (escrow)", to: { asset: "NGN", amount: amt }, provider: "Cashpoint NGN", moves: [["cashpoint-ngn", amt]], critical: true });
        pushRoute(A("NGN"), B("cashpoint-ngn"), E(`Code ${meta.cashpointCode.slice(0, 4)}…`));
        source = { asset: "NGN", amount: amt + f }; destination = { asset: "NGN", amount: amt };
        title = `Cashpoint ${meta.cashpointCode.slice(0, 4)} •••• ${meta.cashpointCode.slice(-4)}`;
        if (status === "reversed") status = "completed";
        break;
      }
      case "cashpoint_redeem":
      case "cashpoint_cancel": {
        const parent = ev.parent!.tx!;
        const amt = parent.destination!.amount;
        meta.cashpointCode = parent.meta.cashpointCode;
        // Only codes whose escrow hold actually completed can be redeemed/cancelled.
        if (!parent.legs.some((l) => l.kind === "escrow_hold" && l.status === "completed")) continue;
        direction = "in";
        const redeem = type === "cashpoint_redeem";
        const newUser = redeem && rng.chance(0.25);
        meta.counterparty = redeem ? (newUser ? `New sign-up @${cust.tag}` : `@${cust.tag}`) : undefined;
        push({ kind: "escrow_release", label: redeem ? "Release from Cashpoint NGN" : "Cancel: release Cashpoint NGN", from: { asset: "NGN", amount: amt }, provider: "Cashpoint NGN", moves: [["cashpoint-ngn", -amt]], critical: true }, wallet("NGN", amt, 1, redeem ? `Credit redeemer @${cust.tag}` : "Refund creator's NGN wallet"));
        pushRoute(E(`Code ${meta.cashpointCode!.slice(0, 4)}…`), B("cashpoint-ngn"), A("NGN"));
        source = { asset: "NGN", amount: amt }; destination = { asset: "NGN", amount: amt };
        title = redeem ? `Redeemed ${meta.cashpointCode!.slice(0, 4)} •••• ${meta.cashpointCode!.slice(-4)}` : `Cancelled ${meta.cashpointCode!.slice(0, 4)} •••• ${meta.cashpointCode!.slice(-4)}`;
        parent.status = redeem ? "completed" : "cancelled";
        parent.meta.counterparty = redeem ? meta.counterparty : undefined;
        break;
      }
      case "airtime":
      case "data":
      case "tv":
      case "electricity": {
        // e.g. GBP → Fiat NGN · Utilities NGN → MTN airtime
        const billers = BILLERS.filter((b) => (type === "airtime" ? b.category === "airtime" || ["mtn", "glo"].includes(b.id) : b.category === type));
        const biller = rng.pick(billers);
        meta.billerId = biller.id;
        const plan = type !== "airtime" && biller.plans ? rng.pick(biller.plans) : undefined;
        const price = plan ? plan.price : type === "electricity" ? rng.pick([3_000, 5_000, 10_000, 20_000, 50_000]) : rng.pick([200, 500, 1_000, 2_000, 5_000]);
        meta.plan = plan?.name;
        meta.target = type === "electricity" ? rng.digits(11) : type === "tv" ? rng.digits(10) : `0${rng.pick(["803", "806", "813", "703", "905", "802"])}${rng.digits(7)}`;
        if (cust.recurring.length && rng.chance(0.15)) meta.recurringId = cust.recurring[0].id;
        const payWith: AssetCode = rng.chance(0.75) ? "NGN" : rng.pick(cust.opened);
        const f = flatOf(type, "NGN");
        revenueNgn += f;
        const needNgn = price + f;
        const productLabel = `${biller.name} ${type === "electricity" ? "token" : type === "tv" ? "subscription" : type}`;
        let payAmt = needNgn;
        pushRoute(A(payWith));
        if (payWith === "NGN") {
          push(wallet("NGN", payAmt, -1), flatLeg("NGN", f));
          feeInSource += f;
        } else {
          payAmt = grossToNgn(payWith, needNgn);
          const c = intoBook({ asset: payWith, amount: payAmt }, deskBook(payWith));
          c.spec.critical = true;
          push(wallet(payWith, payAmt, -1), c.spec, flatLeg("NGN", f));
          feeInSource += f * midRate("NGN", payWith);
          pushRoute(B(deskBook(payWith)));
        }
        if (type === "electricity") {
          meta.token = rng.digits(20);
          meta.units = Math.round((price / NGN_PER_KWH) * 10) / 10;
        }
        push({
          kind: "provider_purchase", label: `Buy ${productLabel}${plan ? ` · ${plan.name}` : ""} from Utilities NGN`,
          from: { asset: "NGN", amount: price }, provider: "Utilities NGN", providerRef: `UTL-${rng.alnum(10)}`,
          moves: [["utilities-ngn", -price]], critical: payWith === "NGN",
        });
        pushRoute(B("utilities-ngn"), E(productLabel));
        source = { asset: payWith, amount: payAmt }; destination = { asset: "NGN", amount: price };
        title = `${biller.name} ${type === "electricity" ? "electricity" : type === "tv" ? "TV" : type}`;
        break;
      }
      case "giftcard_buy": {
        // e.g. USDT → Crypto NGN · Gift card NGN → Steam $50
        const brand = rng.pick(GIFT_BRANDS);
        const face = rng.pick(GIFT_AMOUNTS);
        meta.giftBrand = brand.id; meta.giftFaceUsd = face;
        const payWith: AssetCode = rng.pick(cust.opened);
        // NGN needed so the Gift card NGN leg (fee + markup) yields exactly `face` USD of code.
        const needNgn = round("NGN", face / (midRate("NGN", "USD") * (1 - conv.rate / 100)) / (1 - conv.fee / 100) + 0.01);
        pushRoute(A(payWith));
        let payAmt = needNgn;
        if (payWith === "NGN") push(wallet("NGN", payAmt, -1));
        else {
          payAmt = grossToNgn(payWith, needNgn);
          const c = intoBook({ asset: payWith, amount: payAmt }, deskBook(payWith));
          c.spec.critical = true;
          push(wallet(payWith, payAmt, -1), c.spec);
          pushRoute(B(deskBook(payWith)));
        }
        const buy = outOfBook(needNgn, "giftcard-ngn", "USD", { toPool: null, label: `Buy ${brand.name} $${face} code from Gift card NGN` });
        buy.spec.kind = "provider_purchase";
        buy.spec.providerRef = `GC-${rng.alnum(10)}`;
        if (payWith === "NGN") buy.spec.critical = true;
        push(buy.spec);
        pushRoute(B("giftcard-ngn"), E(`${brand.name} $${face}`));
        source = { asset: payWith, amount: payAmt }; destination = { asset: "USD", amount: face };
        title = `${brand.name} $${face}`;
        break;
      }
      case "giftcard_sell": {
        // e.g. Steam $50 → Gift card NGN → NGN wallet   (or · Crypto NGN → USDT)
        direction = "in";
        const brand = rng.pick(GIFT_BRANDS);
        const face = rng.pick(GIFT_AMOUNTS);
        meta.giftBrand = brand.id; meta.giftFaceUsd = face;
        const toAsset: AssetCode = rng.chance(0.8) ? "NGN" : "USDT";
        const redeem = intoBook({ asset: "USD", amount: face }, "giftcard-ngn", { fromPool: null, base: brand.sellRate, label: `Redeem ${brand.name} $${face} into Gift card NGN` });
        redeem.spec.critical = true;
        redeem.spec.providerRef = `GCV-${rng.alnum(10)}`;
        push(redeem.spec);
        pushRoute(E(`${brand.name} $${face}`), B("giftcard-ngn"));
        let out = redeem.out;
        if (toAsset !== "NGN") {
          const c = outOfBook(redeem.out, "crypto-ngn", toAsset);
          push(c.spec);
          out = c.out;
          pushRoute(B("crypto-ngn"));
        }
        push(wallet(toAsset, out, 1));
        pushRoute(A(toAsset));
        source = { asset: "USD", amount: face }; destination = { asset: toAsset, amount: out };
        title = `Sold ${brand.name} $${face}`;
        if (rng.chance(0.06)) status = "failed";
        break;
      }
    }
    // Fee shown on the transaction: every leg fee + flat fee, expressed in the source asset.
    // (flat fees were added above; here: the 0.1% fee on every conversion leg)
    for (const sp of specs) if (sp.kind !== "fee" && sp.fee) feeInSource += sp.fee.asset === source!.asset ? sp.fee.amount : sp.fee.amount * midRate(sp.fee.asset, source!.asset);
    const fee: Money = { asset: source!.asset, amount: round(source!.asset, Math.max(0, feeInSource)) };
    const spreadNgn = revenueNgn;

    // ── Finalise legs: status, inventory, refunds/reversals ──
    let t = at;
    const legs: Leg[] = [];
    const critIdx = Math.max(0, specs.findIndex((s) => s.critical));
    let debited: Spec | undefined;
    const balMoves = (bal: Bal[] | undefined): BalanceMovement[] =>
      (bal ?? []).map(([customerId, account, asset, delta, card]) => {
        const m: BalanceMovement = { customerId, account, asset, cardId: card?.id, cardLast4: card?.last4, delta: round(asset, delta), before: 0, after: 0 };
        balanceLog.push(m);
        return m;
      });
    if (status === "failed") {
      const common = ["Provider timeout (504)", "Risk rule: velocity limit"];
      const byCat: Record<string, string[]> = {
        currency: ["Beneficiary account invalid", "Insufficient provider liquidity", "Destination address rejected"],
        virtual_card: ["Card declined by issuer", "Card frozen", "Monthly card limit reached"],
        cashpoint: ["Insufficient NGN balance", "Escrow hold rejected"],
        utility: type === "electricity" ? ["Meter number not found", "PHED token service unavailable"] : type === "tv" ? ["Smartcard number invalid"] : ["Phone number not on network"],
        giftcard: type === "giftcard_sell" ? ["Gift card already redeemed", "Card image unreadable"] : ["Brand out of stock"],
      };
      failureReason = rng.pick([...common, ...(byCat[cat] ?? [])]);
    }
    specs.forEach((s, i) => {
      t += rng.int(150, 2_500);
      let st: Leg["status"] = "completed";
      if (status === "failed" && i >= critIdx) st = "failed";
      if (status === "pending" && i >= critIdx) st = "pending";
      const { moves, bal, critical: _c, debit, ...rest } = s;
      void _c;
      const inventory = st === "completed" && moves ? moves.map(([p, d]) => move(p, d, txId, t)) : [];
      const balances = st === "completed" ? balMoves(bal) : [];
      if (st === "completed" && debit) debited = s;
      legs.push({ ...rest, seq: i + 1, status: st, at: iso(t), inventory, balances });
    });
    if (status === "failed" && debited?.from) {
      t += rng.int(2_000, 60_000);
      legs.push({ seq: legs.length + 1, kind: "credit_wallet", label: "Refund to wallet", to: debited.from, status: "completed", at: iso(t), inventory: [], balances: balMoves([[cust.id, "wallet", debited.from.asset, debited.from.amount]]) });
    }
    if (status === "reversed") {
      t += rng.int(HOUR, 2 * DAY);
      const inv = legs.flatMap((l) => l.inventory).map((m) => move(m.poolId, -m.delta, txId, t));
      legs.forEach((l) => l.status === "completed" && l.inventory.length && (l.status = "reversed"));
      // Undo every customer balance change too (refund the debit, claw back any credit).
      const undo = balMoves(legs.flatMap((l) => l.balances).map((b): Bal => [b.customerId, b.account, b.asset, -b.delta, b.cardId ? { id: b.cardId, last4: b.cardLast4! } : undefined]));
      legs.push({ seq: legs.length + 1, kind: "credit_wallet", label: "Reversal: refund to wallet", to: source!, status: "completed", at: iso(t), inventory: inv, balances: undo });
      failureReason = rng.pick(["Provider reversed settlement", "Customer dispute upheld", "Duplicate debit detected"]);
    }

    const tx: Transaction = {
      id: txId, reference, customerId: cust.id, category: cat, type, status, direction, title,
      source: source!, destination, fee, route,
      markupRevenueNgn: status === "failed" || status === "reversed" ? 0 : Math.round(spreadNgn),
      usdValue: Math.round(toUsd(source!.asset, source!.amount) * 100) / 100,
      createdAt: iso(at), failureReason, meta, legs,
    };
    if (type === "cashpoint_create") tx.status = status === "failed" ? "failed" : "pending";
    ev.tx = tx;
    transactions.push(tx);

    // Token Vault mirrors every electricity token bought.
    if (type === "electricity" && status === "completed" && meta.token) {
      cust.vault.push({ id: id("tok"), provider: "PHED", meter: meta.target!, amount: destination!.amount, kwh: meta.units!, token: meta.token, bought: iso(at), loadedOn: rng.chance(0.7) ? iso(at + rng.int(1, 72) * HOUR) : null });
    }
    if (status === "failed" && rng.chance(0.35)) {
      cust.tickets.push({ id: `SUP-${rng.digits(6)}`, txId, reason: rng.pick(["Money left my wallet but didn't arrive", "Wrong amount", "Token not received", "Gift card rejected", "Card declined"]), status: rng.chance(0.6) ? "resolved" : "open", createdAt: iso(at + rng.int(5, 600) * MIN) });
    }

    // API trail for this transaction.
    const EP: Partial<Record<TxType, [HttpMethod, string]>> = {
      swap: ["POST", "/v1/swaps"], withdrawal: ["POST", "/v1/withdrawals"], send: ["POST", "/v1/transfers"],
      card_create: ["POST", "/v1/cards"], card_fund: ["POST", `/v1/cards/${meta.cardId}/fund`], card_withdraw: ["POST", `/v1/cards/${meta.cardId}/withdraw`],
      cashpoint_create: ["POST", "/v1/cashpoints"], cashpoint_redeem: ["POST", "/v1/cashpoints/redeem"], cashpoint_cancel: ["POST", `/v1/cashpoints/${ev.parent?.tx?.id}/cancel`],
      airtime: ["POST", "/v1/bills/airtime"], data: ["POST", "/v1/bills/data"], tv: ["POST", "/v1/bills/tv"], electricity: ["POST", "/v1/bills/electricity"],
      giftcard_buy: ["POST", "/v1/giftcards/buy"], giftcard_sell: ["POST", "/v1/giftcards/sell"],
    };
    const ep = EP[type];
    const lat = () => rng.int(40, 420);
    if (type === "swap" || type === "giftcard_buy" || type === "card_fund") {
      req({ cust, method: "GET", path: `/v1/rates/quote?from=${source!.asset}&to=${destination?.asset ?? "USD"}`, status: 200, latencyMs: rng.int(20, 120), at: iso(at - rng.int(5, 40) * 1000), txId, response: `{"rate":"${fmtNum(midRate(source!.asset, destination?.asset ?? "USD"))}","expiresIn":30}` });
    }
    if (ep) {
      const httpStatus = status === "failed" ? rng.pick([422, 502, 504, 409]) : status === "pending" ? 202 : 201;
      req({
        cust, method: ep[0], path: ep[1], status: httpStatus, latencyMs: status === "failed" && httpStatus >= 500 ? rng.int(4_000, 30_000) : lat(), at: iso(at), txId,
        request: requestBody(type, source!, destination, meta),
        response: httpStatus < 300 ? `{"id":"${txId}","reference":"${reference}","status":"${status}"}` : `{"error":"${failureReason}"}`,
        error: httpStatus >= 400 ? failureReason : undefined,
      });
      if (rng.chance(0.5)) req({ cust, method: "GET", path: `/v1/transactions/${txId}`, status: 200, latencyMs: rng.int(15, 90), at: iso(at + rng.int(2, 60) * 1000), txId });
    } else {
      // Inbound money arrives via provider webhooks.
      const hook = type === "deposit" && ASSETS[source!.asset].kind === "crypto" ? "/webhooks/crypto" : type.startsWith("card_") ? "/webhooks/card-issuer" : type === "receive" && !meta.counterparty?.startsWith("@") ? "/webhooks/nip" : null;
      if (hook) req({ customerId: cust.id, method: "POST", path: hook, status: 200, latencyMs: rng.int(10, 80), at: iso(at), txId, request: `{"event":"${type}","amount":"${source!.amount}","asset":"${source!.asset}"}`, response: `{"ok":true}` });
    }
  }

  // Background API noise: sessions, reads, KYC, and the odd error.
  const NOISE: [HttpMethod, string, number][] = [
    ["POST", "/v1/auth/login", 6], ["POST", "/v1/auth/refresh", 8], ["GET", "/v1/me", 12], ["GET", "/v1/wallets", 14], ["GET", "/v1/transactions?page=1", 10],
    ["GET", "/v1/rates", 10], ["GET", "/v1/vault/tokens", 3], ["GET", "/v1/cards", 4], ["POST", "/v1/kyc/session", 1.5], ["GET", "/v1/beneficiaries", 3],
    ["PATCH", "/v1/me/tag", 0.4], ["POST", "/v1/devices/trust", 0.6], ["GET", "/v1/referrals", 1.5], ["POST", "/v1/recurring", 0.6], ["DELETE", "/v1/beneficiaries/{id}", 0.4],
  ];
  for (let i = 0; i < 8_500; i++) {
    const cust = pickCustomer();
    const at = SEED_NOW - Math.floor((rng.next() ** 1.3) * 90 * DAY);
    const [method, path] = rng.weighted(NOISE.map((n) => [[n[0], n[1]] as const, n[2]] as const));
    let status = method === "POST" ? 200 : 200;
    let error: string | undefined;
    const roll = rng.next();
    if (path === "/v1/auth/login" && roll < 0.12) { status = 401; error = "Invalid credentials"; }
    else if (roll < 0.012) { status = 429; error = "Rate limit exceeded"; }
    else if (roll < 0.018) { status = 500; error = "Internal error"; }
    else if (roll < 0.03) { status = 403; error = "Device not trusted"; }
    req({ cust, method, path: path.replace("{id}", id("ben")), status, latencyMs: status === 500 ? rng.int(800, 6_000) : rng.int(12, 260), at: iso(at), error, request: path === "/v1/auth/login" ? `{"email":"${cust.email}","password":"[REDACTED]"}` : undefined });
  }

  // A few historic markup edits for the audit log.
  ([
    ["swap", "rate 0.8% → 1%", 21, { ratePct: 0.8, feePct: 0.5, flatFee: 0, active: true }, { ratePct: 1, feePct: 0.5, flatFee: 0, active: true }],
    ["giftcard_sell", "rate 2.5% → 2%", 34, { ratePct: 2.5, feePct: 0, flatFee: 0, active: true }, { ratePct: 2, feePct: 0, flatFee: 0, active: true }],
    ["card_refund", "deactivated", 50, { ratePct: 0, feePct: 0, flatFee: 0, active: true }, { ratePct: 0, feePct: 0, flatFee: 0, active: false }],
  ] as const).forEach(([t, s, d, before, after]) => {
    const a = ADMINS[0];
    audit.push({ id: id("aud"), adminId: a.id, adminName: a.name, action: "markup.update", target: t, summary: s, before: JSON.stringify(before), after: JSON.stringify(after), at: iso(SEED_NOW - d * DAY) });
  });

  // ── Customer balances: replay every movement from an opening balance ──
  // Opening = enough to never go negative, plus a small cushion, so before/after
  // on every leg is consistent and the final value is the customer's balance now.
  const byKey = new Map<string, BalanceMovement[]>();
  for (const m of balanceLog) {
    const key = m.account === "card" ? `card:${m.cardId}` : `${m.customerId}:${m.asset}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(m);
  }
  for (const [key, list] of byKey) {
    let run = 0, min = 0;
    for (const m of list) { run += m.delta; min = Math.min(min, run); }
    const asset = list[0].asset;
    let bal = round(asset, -min + rng.amount(0, 250) / ASSETS[asset].usd);
    for (const m of list) {
      m.before = bal;
      bal = round(asset, bal + m.delta);
      m.after = bal;
    }
    if (key.startsWith("card:")) {
      const card = cardById.get(key.slice(5));
      if (card) card.balance = bal;
    } else {
      const c = customers.find((x) => x.id === list[0].customerId)!;
      c.balances[asset] = bal;
      if (!c.opened.includes(asset)) c.opened.push(asset);
    }
  }

  // ── Support threads: every ticket becomes a thread, plus in-app chats ──
  const threads: SupportThread[] = [];
  const agents = ["Zainab Musa", "Tunde Bakare"];
  const msg = (from: "customer" | "agent" | "system", author: string, body: string, at: number) => ({ id: id("msg"), from, author, body, at: iso(at) });
  for (const c of customers) {
    for (const t of c.tickets) {
      const tx = transactions.find((x) => x.id === t.txId);
      const ref = tx?.reference ?? "my last transaction";
      const opener = SUPPORT_OPENERS[t.reason]?.(ref) ?? `Hi, I need help with ${ref}.`;
      const at0 = Date.parse(t.createdAt);
      const agent = rng.pick(agents);
      const messages = [msg("system", "Tribe", `Ticket ${t.id} opened from the app${tx ? ` for ${tx.reference}` : ""}.`, at0), msg("customer", c.firstName, opener, at0 + MIN)];
      let status: SupportThread["status"] = "open";
      if (t.status === "resolved") {
        messages.push(msg("agent", agent, `Hi ${c.firstName}, thanks for reaching out! Checking ${ref} with the provider now 👀`, at0 + rng.int(5, 90) * MIN));
        messages.push(msg("agent", agent, rng.pick(["All sorted: the refund is back in your wallet ✅", "Done! The provider confirmed it went through.", "Fixed on our side, please check again 🙌"]), at0 + rng.int(2, 20) * HOUR));
        messages.push(msg("customer", c.firstName, rng.pick(["Thank you!!", "omg thanks 🙏", "it's showing now, thanks"]), at0 + rng.int(21, 30) * HOUR));
        status = "resolved";
      } else if (rng.chance(0.5)) {
        messages.push(msg("agent", agent, `Hi ${c.firstName}, we're on it. I'll update you shortly.`, at0 + rng.int(5, 90) * MIN));
        status = "pending";
      }
      threads.push({
        id: t.id, customerId: c.id, channel: "ticket", subject: t.reason, txId: t.txId, status,
        priority: tx && tx.usdValue > 300 ? "high" : "normal",
        createdAt: t.createdAt, updatedAt: messages[messages.length - 1].at, activity: 0,
        unread: status === "open" ? rng.int(1, 2) : 0, messages,
      });
    }
  }
  for (let i = 0; i < 46; i++) {
    const c = pickCustomer();
    const at0 = SEED_NOW - Math.floor((rng.next() ** 1.5) * 20 * DAY) - rng.int(0, 5) * HOUR;
    const topic = rng.pick(CHAT_TOPICS);
    const messages = [msg("customer", c.firstName, topic.q, at0)];
    const answered = rng.chance(0.7);
    if (answered) messages.push(msg("agent", rng.pick(agents), topic.a, at0 + rng.int(2, 40) * MIN));
    if (answered && rng.chance(0.4)) messages.push(msg("customer", c.firstName, rng.pick(["ahh ok, thanks!", "perfect 🙌", "got it", "and how long does that take?"]), at0 + rng.int(41, 90) * MIN));
    const last = messages[messages.length - 1];
    threads.push({
      id: `CHT-${rng.digits(6)}`, customerId: c.id, channel: "chat", subject: topic.subject,
      status: last.from === "customer" ? "open" : rng.chance(0.6) ? "resolved" : "pending", priority: "normal",
      createdAt: iso(at0), updatedAt: last.at, activity: 0, unread: last.from === "customer" ? 1 : 0, messages,
    });
  }
  // Only recent customer messages are still unread; older ones were seen.
  for (const t of threads) if (Date.parse(t.updatedAt) < SEED_NOW - 2 * DAY) t.unread = 0;
  threads.sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1)).forEach((t, i) => (t.activity = i + 1));
  threads.reverse();

  // ── Indexes ──────────────────────────────────────────────
  // ISO strings sort lexically; plain comparison is far faster than localeCompare.
  const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  transactions.sort((a, b) => desc(a.createdAt, b.createdAt));
  api.sort((a, b) => desc(a.at, b.at));
  entries.sort((a, b) => desc(a.at, b.at));
  audit.sort((a, b) => desc(a.at, b.at));
  const txByCustomer = new Map<string, Transaction[]>();
  for (const t of transactions) (txByCustomer.get(t.customerId) ?? txByCustomer.set(t.customerId, []).get(t.customerId)!).push(t);
  const apiByCustomer = new Map<string, ApiRequest[]>();
  const apiByTx = new Map<string, ApiRequest[]>();
  for (const r of api) {
    if (r.customerId) (apiByCustomer.get(r.customerId) ?? apiByCustomer.set(r.customerId, []).get(r.customerId)!).push(r);
    if (r.txId) (apiByTx.get(r.txId) ?? apiByTx.set(r.txId, []).get(r.txId)!).push(r);
  }
  for (const c of customers) {
    const last = txByCustomer.get(c.id)?.[0]?.createdAt;
    if (last && last > c.lastActiveAt) c.lastActiveAt = last;
  }

  return {
    customers, customerById: new Map(customers.map((c) => [c.id, c])), verifications,
    transactions, txById: new Map(transactions.map((t) => [t.id, t])), txByCustomer,
    pools, poolById, entries, markups, api, apiByCustomer, apiByTx, audit, threads, activity: threads.length, seq: 0,
  };
}

const SUPPORT_OPENERS: Record<string, (ref: string) => string> = {
  "Money left my wallet but didn't arrive": (r) => `Hi, money left my wallet but it hasn't arrived 😩 Ref ${r}`,
  "Wrong amount": (r) => `I think I was charged the wrong amount on ${r}?`,
  "Token not received": (r) => `Bought electricity but no token came through. Ref ${r}`,
  "Gift card rejected": (r) => `My gift card got rejected but it's 100% valid. Ref ${r}`,
  "Card declined": (r) => `My virtual card keeps getting declined 😭 Ref ${r}`,
};

export const CHAT_TOPICS = [
  { subject: "Upgrading to tier 3", q: "How do I upgrade to tier 3? I want a USD account", a: "Go to Profile → Verification and add an ID document + your address. Approval is usually within minutes 🚀" },
  { subject: "Changing @tag", q: "can I change my @tag?", a: "Yes! Profile → Edit tag. You can change it once every 30 days." },
  { subject: "Swap fees", q: "What's the fee to swap USDT to naira?", a: "You'll always see the exact rate and fee on the quote screen before you confirm, no surprises." },
  { subject: "Recurring bills", q: "how do recurring bills work?", a: "After you pay a bill, tap “Make it recurring”, pick weekly, every 2 weeks or monthly, and choose which balance pays." },
  { subject: "Cashpoint code", q: "Is my cashpoint code still valid? My friend hasn't redeemed it", a: "It stays valid until it's redeemed or you cancel it. Cancelling sends the NGN straight back to you." },
  { subject: "Funding USD account", q: "How do I add money to my USD account?", a: "Open your USD wallet → Add money for your ACH details, or swap from any other balance instantly." },
  { subject: "Token Vault", q: "where do I find my old electricity tokens?", a: "Every token lives in the Token Vault. You can mark each one as loaded so you never lose track ⚡" },
];

function fmtNum(n: number) {
  return Number(n.toPrecision(8)).toString();
}

function requestBody(type: TxType, src: Money, dst: Money | undefined, meta: Transaction["meta"]) {
  const base: Record<string, unknown> = { amount: String(src.amount), asset: src.asset, pin: "[REDACTED]" };
  if (type === "swap") base.to = dst?.asset;
  if (meta.billerId) Object.assign(base, { biller: meta.billerId, target: meta.target ? `${meta.target.slice(0, 3)}•••${meta.target.slice(-3)}` : undefined, plan: meta.plan });
  if (meta.giftBrand) Object.assign(base, { brand: meta.giftBrand, face: meta.giftFaceUsd, code: type === "giftcard_sell" ? "[REDACTED]" : undefined });
  if (meta.cashpointCode && type === "cashpoint_redeem") base.code = "[REDACTED]";
  if (meta.counterparty) base.to = meta.counterparty;
  if (meta.network) base.network = meta.network;
  return JSON.stringify(base);
}
