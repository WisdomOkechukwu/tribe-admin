import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { requirePerm } from "@/lib/auth/current";
import { adminName, listMembers } from "@/lib/auth/users";
import { ASSETS, ASSET_CODES, midRate, toUsd, typeLabel, type RouteStep } from "@/lib/domain/catalog";
import type {
  ApiRequest, AssetCode, AuditEvent, Customer, KycMedia, CustomerRow, InventoryEntry, InventoryPool, MarkupRule, Page, Transaction,
  TxCategory, TxRow, TxStatus, TxType, Verification,
} from "@/lib/domain/types";
import { lagosDay } from "@/lib/format";
import { db } from "./db";
import { SEED_NOW } from "./seed";

// ─────────────────────────────────────────────────────────────────────────────
// Data access layer. The ONLY module pages import for data, and the seam for the
// real backend: swap each internal function for an API call and keep the shapes.
//
// Exported functions authorise first (Next's DAL pattern), then call an
// unexported `'use cache'` function keyed by plain filter values and tagged so
// server actions can `updateTag()` exactly what they changed.
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 50;
export const TAGS = {
  customers: "customers",
  customer: (id: string) => `customer:${id}`,
  tx: "tx",
  inventory: "inventory",
  markups: "markups",
  trail: "trail",
  kyc: "kyc",
  audit: "audit",
  support: "support",
  team: "team",
} as const;

// ── Masking for admins without the sensitive permissions ─────────────────────
const maskEmail = (e: string) => e.replace(/^(.{2})[^@]*(@.*)$/, "$1•••$2");
/** Keeps the country code and last 2 digits: "+234 803 555 0142" → "+234 ••• ••• ••42". */
const maskPhone = (p: string) => {
  const m = p.match(/^(\+\d+\s)?(.*)$/)!;
  return (m[1] ?? "") + m[2].replace(/\d(?=(?:\D*\d){2})/g, "•");
};
const city = (a: string) => a.split(",").slice(-1)[0]?.trim() ?? "—";
function maskPerson<T extends { email: string; phone?: string; address?: string; dob?: string }>(c: T): T {
  return { ...c, email: maskEmail(c.email), ...(c.phone ? { phone: maskPhone(c.phone) } : {}), ...(c.address ? { address: `•••, ${city(c.address)}` } : {}), ...(c.dob ? { dob: "••••-••-••" } : {}) };
}
const stripBodies = <T extends { request?: string; response?: string }>(r: T): T => ({ ...r, request: r.request ? "[hidden: needs “See request & response bodies”]" : undefined, response: r.response ? "[hidden]" : undefined });


/** Reference "now" for relative stats: the dataset's snapshot instant. */
export const DATA_NOW = SEED_NOW;

function paginate<T>(rows: T[], page: number, pageSize = PAGE_SIZE): Page<T> {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((p - 1) * pageSize, p * pageSize), total: rows.length, page: p, pageSize, pages };
}

const totalUsd = (c: Customer) => Object.entries(c.balances).reduce((s, [a, n]) => s + toUsd(a as never, n ?? 0), 0);

function toRow(c: Customer): CustomerRow {
  return {
    id: c.id, firstName: c.firstName, lastName: c.lastName, tag: c.tag, email: c.email, phone: c.phone, country: c.country,
    createdAt: c.createdAt, lastActiveAt: c.lastActiveAt, status: c.status, labels: c.labels, kycTier: c.kycTier, kycStatus: c.kycStatus,
    totalUsd: Math.round(totalUsd(c) * 100) / 100, txCount: db().txByCustomer.get(c.id)?.length ?? 0,
  };
}

function toTxRow(t: Transaction): TxRow {
  const c = db().customerById.get(t.customerId);
  const { legs, ...rest } = t;
  return { ...rest, legCount: legs.length, customerName: c ? `${c.firstName} ${c.lastName}` : "—", customerTag: c?.tag ?? "" };
}

// ── Customers ────────────────────────────────────────────────────────────────
export type CustomerFilters = { q?: string; tags?: string[]; kyc?: string; status?: string; label?: string; tickets?: string; sort?: string; page: number };

export async function listCustomers(f: CustomerFilters) {
  const a = await requirePerm("customers.view");
  const res = await listCustomersCached(f);
  return a.has("customers.pii") ? res : { ...res, rows: res.rows.map(maskPerson) };
}
/**
 * One search for everything: name, email (exact or prefix), @tag, phone or ID,
 * plus tag chips that must ALL match a customer's @handle or an admin label.
 */
async function listCustomersCached(f: CustomerFilters): Promise<Page<CustomerRow> & { exact?: string }> {
  "use cache";
  cacheTag(TAGS.customers);
  cacheLife("hours");
  const q = f.q?.trim().toLowerCase().replace(/^@/, "");
  const tags = (f.tags ?? []).map((t) => t.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  let rows = db().customers.filter((c) => {
    if (f.kyc !== undefined && f.kyc !== "" && String(c.kycTier) !== f.kyc) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.label && !c.labels.includes(f.label)) return false;
    if (f.tickets === "open" && !c.tickets.some((t) => t.status === "open")) return false;
    if (tags.length && !tags.every((t) => c.tag === t || c.tag.startsWith(t) || c.labels.some((l) => l.toLowerCase() === t))) return false;
    if (q && !(`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.startsWith(q) || c.email.includes(q) || c.tag.includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) || c.id === q)) return false;
    return true;
  });
  if (f.sort === "balance") rows = rows.slice().sort((a, b) => totalUsd(b) - totalUsd(a));
  else if (f.sort === "active") rows = rows.slice().sort((a, b) => (a.lastActiveAt < b.lastActiveAt ? 1 : -1));
  else rows = rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  // Exact email / @tag hits float to the top.
  if (q) rows = rows.slice().sort((a, b) => Number(b.email === q || b.tag === q) - Number(a.email === q || a.tag === q));
  const exact = q ? rows.find((c) => c.email === q || c.tag === q)?.id : undefined;
  const page = paginate(rows, f.page);
  return { ...page, rows: page.rows.map(toRow), exact };
}

/** ⌘K quick jump. */
export async function quickSearch(q: string) {
  const a = await requirePerm("customers.view");
  const res = await quickSearchCached(q.trim().toLowerCase().replace(/^@/, "").slice(0, 64));
  return a.has("customers.pii") ? res : res.map((r) => ({ ...r, email: maskEmail(r.email) }));
}
async function quickSearchCached(q: string) {
  "use cache";
  cacheTag(TAGS.customers);
  cacheLife("hours");
  if (q.length < 2) return [];
  const out: { id: string; name: string; tag: string; email: string; kycTier: number; status: string }[] = [];
  for (const c of db().customers) {
    const name = `${c.firstName} ${c.lastName}`;
    if (c.tag.startsWith(q) || c.email.startsWith(q) || name.toLowerCase().includes(q)) {
      out.push({ id: c.id, name, tag: c.tag, email: c.email, kycTier: c.kycTier, status: c.status });
      if (out.length >= 8) break;
    }
  }
  return out;
}

export async function getCustomer(id: string) {
  const a = await requirePerm("customers.view");
  const c = await getCustomerCached(id);
  return c && !a.has("customers.pii") ? maskPerson(c) : c;
}
async function getCustomerCached(id: string): Promise<(Customer & { totalUsd: number; txCount: number; volumeUsd: number; revenueNgn: number }) | null> {
  "use cache";
  cacheTag(TAGS.customer(id));
  cacheLife("hours");
  const c = db().customerById.get(id);
  if (!c) return null;
  const txs = db().txByCustomer.get(id) ?? [];
  const ok = txs.filter((t) => t.status === "completed");
  return {
    ...c,
    totalUsd: Math.round(totalUsd(c) * 100) / 100,
    txCount: txs.length,
    volumeUsd: Math.round(ok.reduce((s, t) => s + t.usdValue, 0)),
    revenueNgn: ok.reduce((s, t) => s + t.markupRevenueNgn, 0),
  };
}

export async function getCustomerVerifications(id: string) {
  const a = await requirePerm("kyc.view");
  const res = await getCustomerVerificationsCached(id);
  return a.has("kyc.media") ? res : res.map((v) => ({ ...v, media: [] }));
}
async function getCustomerVerificationsCached(id: string): Promise<Verification[]> {
  "use cache";
  cacheTag(TAGS.customer(id), TAGS.kyc);
  cacheLife("hours");
  return db().verifications.filter((v) => v.customerId === id).sort((a, b) => a.tier - b.tier || (a.submittedAt < b.submittedAt ? -1 : 1));
}

export async function getCustomerTransactions(id: string, f: { category?: string; page: number }) {
  await requirePerm("transactions.view");
  return getCustomerTransactionsCached(id, f);
}
async function getCustomerTransactionsCached(id: string, f: { category?: string; page: number }) {
  "use cache";
  cacheTag(TAGS.customer(id), TAGS.tx);
  cacheLife("hours");
  const all = db().txByCustomer.get(id) ?? [];
  const counts: Record<string, number> = { all: all.length };
  for (const t of all) counts[t.category] = (counts[t.category] ?? 0) + 1;
  const rows = f.category ? all.filter((t) => t.category === f.category) : all;
  const page = paginate(rows, f.page);
  return { ...page, rows: page.rows.map(toTxRow), counts };
}

export async function getCustomerApiTrail(id: string, f: { status?: string; page: number }) {
  const a = await requirePerm("api.view");
  const res = await getCustomerApiTrailCached(id, f);
  return a.has("api.bodies") ? res : { ...res, rows: res.rows.map(stripBodies) };
}
async function getCustomerApiTrailCached(id: string, f: { status?: string; page: number }) {
  "use cache";
  cacheTag(TAGS.customer(id), TAGS.trail);
  cacheLife("hours");
  const all = db().apiByCustomer.get(id) ?? [];
  const rows = f.status ? all.filter((r) => statusClass(r.status) === f.status) : all;
  return paginate(rows, f.page);
}

// ── Transactions ─────────────────────────────────────────────────────────────
export type TxFilters = {
  category?: string; type?: string; status?: string; asset?: string; q?: string; from?: string; to?: string; page: number;
};

export async function listTransactions(f: TxFilters) {
  await requirePerm("transactions.view");
  return listTransactionsCached(f);
}
async function listTransactionsCached(f: TxFilters) {
  "use cache";
  cacheTag(TAGS.tx);
  cacheLife("hours");
  const q = f.q?.trim().toLowerCase().replace(/\s/g, "");
  const base = db().transactions.filter((t) => {
    if (f.type && t.type !== f.type) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.asset && t.source.asset !== f.asset && t.destination?.asset !== f.asset) return false;
    if (f.from && lagosDay(t.createdAt) < f.from) return false;
    if (f.to && lagosDay(t.createdAt) > f.to) return false;
    if (q) {
      const hit =
        t.reference.toLowerCase() === q || t.id === q || t.reference.toLowerCase().includes(q) ||
        t.meta.cashpointCode === q || t.meta.token === q || t.meta.target === q || t.meta.cardLast4 === q;
      if (!hit) return false;
    }
    return true;
  });
  const counts: Record<string, number> = { all: base.length };
  for (const t of base) counts[t.category] = (counts[t.category] ?? 0) + 1;
  const rows = f.category ? base.filter((t) => t.category === f.category) : base;
  const volumeUsd = Math.round(rows.reduce((s, t) => s + (t.status === "completed" ? t.usdValue : 0), 0));
  const revenueNgn = rows.reduce((s, t) => s + t.markupRevenueNgn, 0);
  const page = paginate(rows, f.page);
  return { ...page, rows: page.rows.map(toTxRow), counts, volumeUsd, revenueNgn };
}

export async function getTransaction(id: string) {
  const a = await requirePerm("transactions.view");
  const res = await getTransactionCached(id);
  if (!res) return res;
  const api = !a.has("api.view") ? [] : a.has("api.bodies") ? res.api : res.api.map(stripBodies);
  return { ...res, api, customer: res.customer && !a.has("customers.pii") ? maskPerson(res.customer) : res.customer };
}
async function getTransactionCached(id: string) {
  "use cache";
  cacheTag(TAGS.tx, TAGS.inventory, `tx:${id}`);
  cacheLife("hours");
  const d = db();
  const tx = d.txById.get(id) ?? d.transactions.find((t) => t.reference === id.toUpperCase());
  if (!tx) return null;
  const c = d.customerById.get(tx.customerId);
  const poolIds = new Set(tx.legs.flatMap((l) => l.inventory.map((m) => m.poolId)));
  const pools = Object.fromEntries([...poolIds].map((p) => [p, { provider: d.poolById.get(p)!.provider, label: d.poolById.get(p)!.label, kind: d.poolById.get(p)!.kind, asset: d.poolById.get(p)!.asset }]));

  // Customer side: every wallet/card the transaction touched — before (first), after (last), now.
  const people: Record<string, { name: string; tag: string }> = {};
  const customerImpact = new Map<string, { key: string; customerId: string; account: "wallet" | "card"; asset: AssetCode; cardLast4?: string; before: number; after: number; delta: number; now: number }>();
  for (const l of tx.legs) {
    for (const b of l.balances) {
      const who = d.customerById.get(b.customerId);
      if (who) people[b.customerId] = { name: `${who.firstName} ${who.lastName}`, tag: who.tag };
      const key = b.account === "card" ? `card:${b.cardId}` : `${b.customerId}:${b.asset}`;
      const cur = customerImpact.get(key);
      if (cur) { cur.after = b.after; cur.delta += b.delta; }
      else {
        const now = b.account === "card" ? who?.cards.find((k) => k.id === b.cardId)?.balance ?? b.after : who?.balances[b.asset] ?? b.after;
        customerImpact.set(key, { key, customerId: b.customerId, account: b.account, asset: b.asset, cardLast4: b.cardLast4, before: b.before, after: b.after, delta: b.delta, now });
      }
    }
  }
  // System side: provider pools — before (first), after (last), now.
  const systemImpact = new Map<string, { poolId: string; provider: string; label: string; asset: AssetCode; before: number; after: number; delta: number; now: number }>();
  for (const l of tx.legs) {
    for (const m of l.inventory) {
      const cur = systemImpact.get(m.poolId);
      if (cur) { cur.after = m.after; cur.delta += m.delta; }
      else {
        const p = d.poolById.get(m.poolId)!;
        systemImpact.set(m.poolId, { poolId: m.poolId, provider: p.provider, label: p.label, asset: p.asset, before: m.before, after: m.after, delta: m.delta, now: p.balance });
      }
    }
  }
  const related = tx.meta.cashpointCode
    ? d.transactions.filter((t) => t.meta.cashpointCode === tx.meta.cashpointCode && t.id !== tx.id).map(toTxRow)
    : [];
  return {
    tx, customer: c ? toRow(c) : null, api: d.apiByTx.get(tx.id) ?? [], pools, related, people,
    customerImpact: [...customerImpact.values()], systemImpact: [...systemImpact.values()],
  };
}

export type TxDetail = NonNullable<Awaited<ReturnType<typeof getTransactionCached>>>;

// ── Currencies ───────────────────────────────────────────────────────────────
export async function listCurrencies() {
  await requirePerm("currencies.view");
  return listCurrenciesCached();
}
async function listCurrenciesCached() {
  "use cache";
  cacheTag(TAGS.tx, TAGS.inventory, TAGS.customers);
  cacheLife("hours");
  const d = db();
  const since7 = new Date(DATA_NOW - 7 * 86_400_000).toISOString();
  const vol = new Map<AssetCode, number>();
  const cnt = new Map<AssetCode, number>();
  for (const t of d.transactions) {
    if (t.createdAt < since7) break;
    if (t.status !== "completed") continue;
    for (const a of new Set([t.source.asset, t.destination?.asset].filter(Boolean) as AssetCode[])) {
      vol.set(a, (vol.get(a) ?? 0) + t.usdValue);
      cnt.set(a, (cnt.get(a) ?? 0) + 1);
    }
  }
  return ASSET_CODES.map((code) => {
    let holders = 0, held = 0;
    for (const c of d.customers) {
      const b = c.balances[code];
      if (b && c.opened.includes(code)) { holders++; held += b; }
    }
    const liquidity = d.pools.filter((p) => p.asset === code).reduce((s, p) => s + p.balance, 0);
    return {
      ...ASSETS[code],
      ngnRate: midRate(code, "NGN"),
      holders, held, liquidity,
      cover: held > 0 ? liquidity / held : null,
      vol7Usd: Math.round(vol.get(code) ?? 0), tx7: cnt.get(code) ?? 0,
    };
  });
}

// ── API trail ────────────────────────────────────────────────────────────────
export type TrailFilters = { q?: string; method?: string; status?: string; path?: string; slow?: string; page: number };
export type TrailRow = ApiRequest & { customerName?: string; customerTag?: string };

export const statusClass = (s: number) => (s >= 500 ? "5xx" : s >= 400 ? "4xx" : "2xx");

export async function listApiTrail(f: TrailFilters) {
  const a = await requirePerm("api.view");
  const res = await listApiTrailCached(f);
  return a.has("api.bodies") ? res : { ...res, rows: res.rows.map(stripBodies) };
}
async function listApiTrailCached(f: TrailFilters) {
  "use cache";
  cacheTag(TAGS.trail);
  cacheLife("hours");
  const d = db();
  const q = f.q?.trim().toLowerCase().replace(/^@/, "");
  let ids: Set<string> | null = null;
  if (q) {
    ids = new Set(d.customers.filter((c) => c.email.startsWith(q) || c.tag === q || c.id === q).map((c) => c.id));
  }
  const path = f.path?.trim().toLowerCase();
  const rows = d.api.filter((r) => {
    if (f.method && r.method !== f.method) return false;
    if (f.status && statusClass(r.status) !== f.status) return false;
    if (f.slow && r.latencyMs < 1000) return false;
    if (path && !r.path.toLowerCase().includes(path)) return false;
    if (ids && !(r.customerId && ids.has(r.customerId)) && r.requestId !== q && r.txId !== q) return false;
    return true;
  });
  const page = paginate(rows, f.page);
  const err = rows.length ? rows.filter((r) => r.status >= 500).length / rows.length : 0;
  return {
    ...page,
    errorRate: err,
    rows: page.rows.map((r): TrailRow => {
      const c = r.customerId ? d.customerById.get(r.customerId) : undefined;
      return { ...r, customerName: c ? `${c.firstName} ${c.lastName}` : undefined, customerTag: c?.tag };
    }),
  };
}

// ── Inventory ────────────────────────────────────────────────────────────────
export async function listInventory() {
  await requirePerm("inventory.view");
  return listInventoryCached();
}
async function listInventoryCached(): Promise<(InventoryPool & { usd: number; out7d: number })[]> {
  "use cache";
  cacheTag(TAGS.inventory);
  cacheLife("hours");
  const d = db();
  const since = new Date(DATA_NOW - 7 * 86_400_000).toISOString();
  const out = new Map<string, number>();
  for (const e of d.entries) {
    if (e.at < since) break;
    if (e.kind === "deduction") out.set(e.poolId, (out.get(e.poolId) ?? 0) - e.delta);
  }
  return d.pools.map((p) => ({ ...p, usd: Math.round(toUsd(p.asset, p.balance)), out7d: out.get(p.id) ?? 0 }));
}

export async function listInventoryEntries(f: { pool?: string; kind?: string; page: number }) {
  await requirePerm("inventory.view");
  return listInventoryEntriesCached(f);
}
async function listInventoryEntriesCached(f: { pool?: string; kind?: string; page: number }): Promise<Page<InventoryEntry & { provider: string; label: string; asset: string; adminName?: string; txRef?: string }>> {
  "use cache";
  cacheTag(TAGS.inventory);
  cacheLife("hours");
  const d = db();
  const rows = d.entries.filter((e) => (!f.pool || e.poolId === f.pool) && (!f.kind || e.kind === f.kind));
  const page = paginate(rows, f.page);
  return {
    ...page,
    rows: page.rows.map((e) => ({
      ...e,
      provider: d.poolById.get(e.poolId)?.provider ?? e.poolId,
      label: d.poolById.get(e.poolId)?.label ?? e.poolId,
      asset: d.poolById.get(e.poolId)?.asset ?? "",
      adminName: adminName(e.adminId),
      txRef: e.txId ? d.txById.get(e.txId)?.reference : undefined,
    })),
  };
}

// ── Markups ──────────────────────────────────────────────────────────────────
export async function listMarkups() {
  await requirePerm("markups.view");
  return listMarkupsCached();
}
async function listMarkupsCached(): Promise<MarkupRule[]> {
  "use cache";
  cacheTag(TAGS.markups);
  cacheLife("hours");
  return db().markups.map((m) => ({ ...m }));
}

// ── Verifications queue ──────────────────────────────────────────────────────
export async function listVerificationQueue(f: { status?: string; page: number }) {
  const a = await requirePerm("kyc.view");
  const res = await listVerificationQueueCached(f);
  const pii = a.has("customers.pii"), media = a.has("kyc.media");
  return { ...res, rows: res.rows.map((r) => ({ ...r, customerEmail: pii ? r.customerEmail : maskEmail(r.customerEmail), media: media ? r.media : [], referencePhoto: media ? r.referencePhoto : undefined })) };
}
async function listVerificationQueueCached(f: { status?: string; page: number }) {
  "use cache";
  cacheTag(TAGS.kyc);
  cacheLife("hours");
  const d = db();
  const status = f.status || "pending";
  const rows = d.verifications
    .filter((v) => v.status === status)
    .sort((a, b) => (status === "pending" ? (a.submittedAt < b.submittedAt ? -1 : 1) : (a.submittedAt < b.submittedAt ? 1 : -1)));
  const page = paginate(rows, f.page);
  const counts = { pending: 0, approved: 0, failed: 0 } as Record<string, number>;
  for (const v of d.verifications) counts[v.status] = (counts[v.status] ?? 0) + 1;
  return {
    ...page,
    counts,
    rows: page.rows.map((v) => {
      const c = d.customerById.get(v.customerId)!;
      return { ...v, customerName: `${c.firstName} ${c.lastName}`, customerTag: c.tag, customerEmail: c.email, currentTier: c.kycTier, referencePhoto: referencePhotoFor(c.id) };
    }),
  };
}

/** The government record photo (BVN, else NIN) to compare selfies and ID photos against. */
function referencePhotoFor(customerId: string): KycMedia | undefined {
  const vs = db().verifications.filter((v) => v.customerId === customerId);
  return vs.flatMap((v) => v.media).find((m) => m.kind === "bvn_photo") ?? vs.flatMap((v) => v.media).find((m) => m.kind === "nin_photo");
}

// ── Support ──────────────────────────────────────────────────────────────────
export type ThreadRow = {
  id: string; customerId: string; customerName: string; customerTag: string; channel: "ticket" | "chat"; subject: string;
  status: string; priority: string; unread: number; updatedAt: string; preview: string; previewFrom: string; txId?: string;
};

export async function listThreads(f: { status?: string; channel?: string }) {
  await requirePerm("support.view");
  return listThreadsCached(f);
}
async function listThreadsCached(f: { status?: string; channel?: string }) {
  "use cache";
  cacheTag(TAGS.support);
  cacheLife("hours");
  const d = db();
  const counts: Record<string, number> = { all: d.threads.length, open: 0, pending: 0, resolved: 0, unread: 0 };
  for (const t of d.threads) {
    counts[t.status]++;
    counts.unread += t.unread;
  }
  const rows = d.threads
    .filter((t) => (!f.status || t.status === f.status) && (!f.channel || t.channel === f.channel))
    .slice(0, 80)
    .map((t): ThreadRow => {
      const c = d.customerById.get(t.customerId);
      const last = [...t.messages].reverse().find((m) => m.from !== "system") ?? t.messages[t.messages.length - 1];
      return {
        id: t.id, customerId: t.customerId, customerName: c ? `${c.firstName} ${c.lastName}` : "—", customerTag: c?.tag ?? "",
        channel: t.channel, subject: t.subject, status: t.status, priority: t.priority, unread: t.unread, updatedAt: t.updatedAt,
        preview: last.body, previewFrom: last.from, txId: t.txId,
      };
    });
  return { rows, counts };
}

export async function getThread(id: string) {
  const a = await requirePerm("support.view");
  const res = await getThreadCached(id);
  return res && res.customer && !a.has("customers.pii") ? { ...res, customer: maskPerson(res.customer) } : res;
}
async function getThreadCached(id: string) {
  "use cache";
  cacheTag(TAGS.support, `thread:${id}`);
  cacheLife("hours");
  const d = db();
  const t = d.threads.find((x) => x.id === id);
  if (!t) return null;
  const c = d.customerById.get(t.customerId);
  const tx = t.txId ? d.txById.get(t.txId) : undefined;
  return {
    thread: t,
    customer: c ? toRow(c) : null,
    tx: tx ? { id: tx.id, reference: tx.reference, title: tx.title, status: tx.status, legCount: tx.legs.length, source: tx.source } : null,
  };
}

// ── Audit ────────────────────────────────────────────────────────────────────
export async function listAudit(f: { action?: string; page: number }) {
  await requirePerm("audit.view");
  return listAuditCached(f);
}
async function listAuditCached(f: { action?: string; page: number }): Promise<Page<AuditEvent>> {
  "use cache";
  cacheTag(TAGS.audit);
  cacheLife("hours");
  const rows = db().audit.filter((a) => !f.action || a.action.startsWith(f.action));
  return paginate(rows, f.page);
}

// ── Overview ─────────────────────────────────────────────────────────────────
export async function getOverview() {
  await requirePerm("overview.view");
  return getOverviewCached();
}
async function getOverviewCached() {
  "use cache";
  cacheTag(TAGS.tx, TAGS.inventory, TAGS.kyc, TAGS.customers);
  cacheLife("hours");
  const d = db();
  const DAY = 86_400_000;
  const since = (ms: number) => new Date(DATA_NOW - ms).toISOString();
  const d1 = since(DAY), d7 = since(7 * DAY), d14 = since(14 * DAY), d30 = since(30 * DAY);

  const byCat7: Record<TxCategory, { volumeUsd: number; count: number; revenueNgn: number }> = {
    currency: { volumeUsd: 0, count: 0, revenueNgn: 0 }, virtual_card: { volumeUsd: 0, count: 0, revenueNgn: 0 },
    cashpoint: { volumeUsd: 0, count: 0, revenueNgn: 0 }, utility: { volumeUsd: 0, count: 0, revenueNgn: 0 }, giftcard: { volumeUsd: 0, count: 0, revenueNgn: 0 },
  };
  const statusCount24: Partial<Record<TxStatus, number>> = {};
  const zeroCats = (): Record<TxCategory, number> => ({ currency: 0, virtual_card: 0, cashpoint: 0, utility: 0, giftcard: 0 });
  const series = new Map<string, { volumeUsd: number; revenueNgn: number; count: number; failed: number; byCat: Record<TxCategory, number> }>();
  for (let i = 29; i >= 0; i--) series.set(lagosDay(DATA_NOW - i * DAY), { volumeUsd: 0, revenueNgn: 0, count: 0, failed: 0, byCat: zeroCats() });
  // Success rate by product (7d), revenue mix (30d) and top routes (7d).
  const outcome7 = Object.fromEntries(Object.keys(byCat7).map((k) => [k, { completed: 0, pending: 0, failed: 0, reversed: 0, cancelled: 0 }])) as Record<TxCategory, Record<TxStatus, number>>;
  const rev30ByCat = Object.fromEntries(Object.keys(byCat7).map((k) => [k, { revenueNgn: 0, count: 0 }])) as Record<TxCategory, { revenueNgn: number; count: number }>;
  const routes7 = new Map<string, { steps: RouteStep[]; count: number; volumeUsd: number; revenueNgn: number }>();
  let vol1 = 0, vol7 = 0, volPrev7 = 0, rev1 = 0, rev7 = 0, rev30 = 0, revPrev7 = 0, pendingAll = 0;
  const failedRecent: Transaction[] = [];
  // Activity heatmap: weekday (Mon=0) × hour, Lagos time (UTC+1, no DST), last 30 days.
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const typeCounts7 = new Map<TxType, number>();

  for (const t of d.transactions) {
    if (t.status === "pending") pendingAll++;
    if (t.createdAt < d30) continue;
    const ok = t.status === "completed";
    const s = series.get(lagosDay(t.createdAt));
    if (s) {
      s.count++;
      if (ok) { s.volumeUsd += t.usdValue; s.byCat[t.category] += t.usdValue; }
      s.revenueNgn += t.markupRevenueNgn;
      if (t.status === "failed") s.failed++;
    }
    rev30 += t.markupRevenueNgn;
    rev30ByCat[t.category].revenueNgn += t.markupRevenueNgn;
    rev30ByCat[t.category].count++;
    const lagos = new Date(Date.parse(t.createdAt) + 3_600_000);
    heat[(lagos.getUTCDay() + 6) % 7][lagos.getUTCHours()]++;
    if (t.createdAt >= d7) {
      if (ok) vol7 += t.usdValue;
      rev7 += t.markupRevenueNgn;
      const c = byCat7[t.category];
      c.count++;
      if (ok) c.volumeUsd += t.usdValue;
      c.revenueNgn += t.markupRevenueNgn;
      typeCounts7.set(t.type, (typeCounts7.get(t.type) ?? 0) + 1);
      outcome7[t.category][t.status]++;
      if (ok) {
        const steps = genericRoute(t);
        const key = JSON.stringify(steps);
        const r = routes7.get(key) ?? routes7.set(key, { steps, count: 0, volumeUsd: 0, revenueNgn: 0 }).get(key)!;
        r.count++;
        r.volumeUsd += t.usdValue;
        r.revenueNgn += t.markupRevenueNgn;
      }
    } else if (t.createdAt >= d14) {
      if (ok) volPrev7 += t.usdValue;
      revPrev7 += t.markupRevenueNgn;
    }
    if (t.createdAt >= d1) {
      if (ok) vol1 += t.usdValue;
      rev1 += t.markupRevenueNgn;
      statusCount24[t.status] = (statusCount24[t.status] ?? 0) + 1;
      if (t.status === "failed" && failedRecent.length < 8) failedRecent.push(t);
    }
  }

  let api24 = 0, api5xx = 0;
  const lat: number[] = [];
  for (const r of d.api) {
    if (r.at < d1) break;
    api24++;
    if (r.status >= 500) api5xx++;
    lat.push(r.latencyMs);
  }
  lat.sort((a, b) => a - b);

  const signups7 = d.customers.filter((c) => c.createdAt >= d7).length;
  const kycPending = d.verifications.filter((v) => v.status === "pending").length;
  const openTickets = d.customers.filter((c) => c.tickets.some((t) => t.status === "open")).length;
  const lowPools = d.pools.filter((p) => p.lowThreshold > 0 && p.balance < p.lowThreshold * 1.5).map((p) => ({ id: p.id, provider: p.provider, label: p.label, asset: p.asset, balance: p.balance, lowThreshold: p.lowThreshold }));
  const tx24 = Object.values(statusCount24).reduce((s, n) => s + (n ?? 0), 0);

  // NGN books: closing balance per day (rebuilt backwards from the ledger) and
  // runway = days until the book hits its minimum at the last 7 days' net burn
  // (top-ups excluded, so it shows the real drain).
  const dayKeys = [...series.keys()];
  const dayEnd = (k: string) => new Date(Date.parse(`${k}T23:59:59.999+01:00`)).toISOString();
  const books = d.pools.filter((p) => p.kind === "book").map((p) => {
    const mine = d.entries.filter((e) => e.poolId === p.id); // newest first
    const closes: number[] = [];
    let bal = p.balance, i = 0;
    for (let k = dayKeys.length - 1; k >= 0; k--) {
      const end = dayEnd(dayKeys[k]);
      while (i < mine.length && mine[i].at > end) { bal -= mine[i].delta; i++; }
      closes[k] = bal;
    }
    let net7 = 0, out7 = 0;
    for (const e of mine) {
      if (e.at < d7) break;
      if (e.kind === "topup") continue;
      net7 += e.delta;
      if (e.delta < 0) out7 -= e.delta;
    }
    const burnPerDay = net7 < 0 ? -net7 / 7 : 0;
    const runwayDays = burnPerDay > 0 ? Math.max(0, (p.balance - p.lowThreshold) / burnPerDay) : null;
    return { id: p.id, label: p.label, balance: p.balance, low: p.lowThreshold, topup: p.topup, closes: closes.map((x) => Math.round(x)), net7: Math.round(net7), out7: Math.round(out7), burnPerDay: Math.round(burnPerDay), runwayDays };
  });

  return {
    asOf: new Date(DATA_NOW).toISOString(),
    vol1: Math.round(vol1), vol7: Math.round(vol7), volPrev7: Math.round(volPrev7),
    rev1, rev7, rev30, revPrev7,
    tx24, statusCount24, failRate24: tx24 ? (statusCount24.failed ?? 0) / tx24 : 0, pendingAll,
    byCat7,
    series: [...series.entries()].map(([day, v]) => ({ day, ...v, volumeUsd: Math.round(v.volumeUsd), byCat: Object.fromEntries(Object.entries(v.byCat).map(([k, n]) => [k, Math.round(n)])) as Record<TxCategory, number> })),
    books,
    outcome7,
    rev30ByCat,
    topRoutes7: [...routes7.values()].sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, 7).map((r) => ({ ...r, volumeUsd: Math.round(r.volumeUsd), revenueNgn: Math.round(r.revenueNgn) })),
    failedRecent: failedRecent.map(toTxRow),
    heat,
    topTypes7: [...typeCounts7.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    customers: d.customers.length, signups7, kycPending, openTickets,
    api24, apiErrRate: api24 ? api5xx / api24 : 0, p95: lat.length ? lat[Math.floor(lat.length * 0.95)] : 0,
    lowPools,
    totalInventoryUsd: Math.round(d.pools.reduce((s, p) => s + toUsd(p.asset, p.balance), 0)),
  };
}

/** Route with customer-specific ends (banks, @tags, codes) replaced by a generic label, so routes group into corridors. */
function genericRoute(t: Transaction): RouteStep[] {
  const end = (): string => {
    switch (t.type) {
      case "airtime": case "data": case "tv": case "electricity": return typeLabel(t.type);
      case "card_fund": case "card_withdraw": case "card_spend": case "card_refund": case "card_chargeback": case "card_create": return "Card";
      case "cashpoint_create": case "cashpoint_redeem": case "cashpoint_cancel": return "Cashpoint code";
      case "giftcard_buy": case "giftcard_sell": return "Gift card";
      case "send": case "receive": return t.meta.counterparty?.startsWith("@") ? "Tribe user" : "Bank";
      case "withdrawal": return ASSETS[t.source.asset].kind === "crypto" ? "External wallet" : "Bank";
      case "deposit": return ASSETS[t.source.asset].kind === "crypto" ? "On-chain" : "Bank";
      default: return "Outside";
    }
  };
  const out: RouteStep[] = [];
  for (const st of t.route) {
    const g: RouteStep = st.t === "end" ? { t: "end", label: end() } : st;
    const last = out[out.length - 1];
    if (!last || JSON.stringify(last) !== JSON.stringify(g)) out.push(g);
  }
  return out;
}

// ── Team ─────────────────────────────────────────────────────────────────────
/** Not cached: membership/permissions must always be current. */
export async function listTeam() {
  await requirePerm("team.view");
  return listMembers().sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || (a.createdAt < b.createdAt ? -1 : 1));
}
