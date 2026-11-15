import "server-only";
import { cache } from "react";
import * as api from "@/lib/api/client";
import { getAccess, requirePerm as checkPerm } from "@/lib/auth/current";
import { assetInfo, rememberAssets } from "@/lib/domain/catalog";
import { fromUnits } from "@/lib/domain/money";
import { detectRole, normalisePerms, asAvatarColor, type Permission } from "@/lib/domain/permissions";
import type {
  ApiRequest, AssetCode, AuditEvent, CardDesign, Customer, CustomerAdjustment, CustomerRow, FreeFunds, Jobs, JournalLeg, JournalView, LedgerAccount,
  LedgerSnapshot, Page, Provider, RateMargin, RatePoint, RatesSnapshot, ServiceSwitch, SupportMessage, SupportThread, SwapLeg, TransactionFee, TreasuryFunding,
  TxCategory, TxDetail, TxRow, TxStatus, VerificationSubmission,
} from "@/lib/domain/types";

// ─────────────────────────────────────────────────────────────────────────────
// Data access layer. The ONLY module pages import for data. Every export
// checks the admin's permission first (Next's DAL pattern), then reads the Go
// admin API and maps its snake_case resources onto lib/domain/types.ts.
//
// Nothing here is cached across requests: the API is the source of truth, and
// the Go side already masks personal data (customers.pii) and strips request
// bodies (api.bodies) for admins without those permissions. Within ONE render
// (or one server action) identical GETs are deduped with React cache(), so
// sections that need the same resource (e.g. /inventory on Inventory, or the
// old /overview aggregate as a fallback) share one HTTP call.
// ─────────────────────────────────────────────────────────────────────────────

type Query = Record<string, string | number | boolean | undefined | null>;
const key = (q?: Query) => JSON.stringify(q ?? {});
const cachedGet = cache((path: string, q: string) => api.get<unknown>(path, JSON.parse(q) as Query));
const cachedGetOrNull = cache((path: string, q: string) => api.getOrNull<unknown>(path, JSON.parse(q) as Query));
const cachedGetWithMeta = cache((path: string, q: string) => api.getWithMeta<unknown, unknown>(path, JSON.parse(q) as Query));
const get = <T>(path: string, query?: Query) => cachedGet(path, key(query)) as Promise<T>;
const getOrNull = <T>(path: string, query?: Query) => cachedGetOrNull(path, key(query)) as Promise<T | null>;
const getWithMeta = <T, M = unknown>(path: string, query?: Query) => cachedGetWithMeta(path, key(query)) as Promise<{ data: T; meta: M | null }>;
/** A route the backend may not ship yet: null on 404/405, so a fallback can run (an empty `null` payload stays `{ data: null }`). */
const cachedTryGet = cache(async (path: string, q: string) => {
  try {
    return { data: await api.get<unknown>(path, JSON.parse(q) as Query) };
  } catch (e) {
    if (e instanceof api.ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
});
const tryGet = <T>(path: string, query?: Query) => cachedTryGet(path, key(query)) as Promise<{ data: T } | null>;

export const PAGE_SIZE = 50;

// ── Go shapes (only the fields we use) ───────────────────────────────────────
type GPage<T> = { rows: T[] | null; total: number; page: number; page_size: number; pages: number };
type GCustomer = {
  id: string; first_name: string; last_name: string; tag: string; email: string; phone: string; country: string; status: string;
  kyc_tier: number; kyc_status: string; labels: string[] | null; created_at: string; last_active_at: string | null; version: number;
};
type GTx = {
  id: string; reference: string; user_id: string; category: string; type: string; direction: string; status: string; title: string; subtitle: string;
  from_asset: string; from_amount: string; to_asset: string | null; to_amount: string | null; fee_asset: string | null; fee_amount: string;
  usd_value: string; journal_entry_id: string | null; quote_id: string | null; metadata: Record<string, unknown> | null; failure_reason: string | null;
  created_at: string; completed_at: string | null; customer_name?: string; customer_tag?: string;
};
type GLeg = {
  id: number; journal_entry_id: string; ledger_account_id: number; asset_code: string; side: "debit" | "credit"; amount: string; amount_decimal?: string;
  usd_rate: string; ngn_rate: string; memo: string; created_at: string; account_number: string; account_name: string; account_category: string;
};
type GEntry = {
  id: string; reference: string; transaction_type: string; description: string; status: string; reverses_entry_id: string | null;
  business_transaction_id: string | null; created_by: string; metadata: Record<string, unknown> | null; accounting_date: string; posted_at: string;
};
type GAccount = {
  id: number; account_number: string; owner_key: string; code: string; name: string; category: string; normal_side: "debit" | "credit"; asset_code: string;
  user_id: string | null; account_type: string; allow_negative: boolean; status: string; created_at: string; balance: string;
};

// ── Currencies the API has that this app's built-in list does not ────────────
// An admin can add a currency (POST /currencies). Money arrives in smallest units, so before any
// read maps amounts the server must know that currency's decimal places. Every read starts with
// requirePerm, which is why the lookup lives there. One request a minute at most, shared by all
// reads; an admin who may not see currencies simply keeps the built-in list.
const PRIME_EVERY_MS = 60_000;
let primedAt = 0;
let priming: Promise<void> | null = null;

function primeAssets() {
  if (Date.now() - primedAt < PRIME_EVERY_MS) return Promise.resolve();
  priming ??= get<{ code: string; name: string; kind: "fiat" | "crypto"; symbol: string; decimal_places: number }[] | null>("/currencies")
    .then((list) => rememberAssets((list ?? []).map((x) => ({ code: x.code as AssetCode, name: x.name, kind: x.kind, decimals: x.decimal_places, symbol: x.symbol || x.code }))))
    .catch(() => {})
    .finally(() => {
      primedAt = Date.now();
      priming = null;
    });
  return priming;
}

async function requirePerm(p: Parameters<typeof checkPerm>[0]) {
  const access = await checkPerm(p);
  await primeAssets();
  return access;
}

// ── Mappers ──────────────────────────────────────────────────────────────────
const pageOf = <G, T>(p: GPage<G>, map: (g: G) => T): Page<T> => ({
  rows: (p.rows ?? []).map(map), total: p.total ?? 0, page: p.page || 1, pageSize: p.page_size || PAGE_SIZE, pages: Math.max(1, p.pages || 1),
});

const toCustomer = (c: GCustomer): CustomerRow => ({
  id: c.id, firstName: c.first_name, lastName: c.last_name, tag: c.tag, email: c.email, phone: c.phone, country: c.country,
  status: c.status as CustomerRow["status"], labels: c.labels ?? [], kycTier: c.kyc_tier as CustomerRow["kycTier"], kycStatus: c.kyc_status as CustomerRow["kycStatus"],
  createdAt: c.created_at, lastActiveAt: c.last_active_at, version: c.version,
});

const asset = (code: string) => code as AssetCode;

const toTx = (t: GTx): TxRow => ({
  id: t.id, reference: t.reference, customerId: t.user_id, category: t.category as TxCategory, type: t.type, status: t.status as TxStatus,
  direction: t.direction === "in" ? "in" : "out", title: t.title, subtitle: t.subtitle,
  source: { asset: asset(t.from_asset), amount: fromUnits(t.from_asset, t.from_amount) },
  destination: t.to_asset && t.to_amount !== null ? { asset: asset(t.to_asset), amount: fromUnits(t.to_asset, t.to_amount) } : undefined,
  fee: t.fee_asset ? { asset: asset(t.fee_asset), amount: fromUnits(t.fee_asset, t.fee_amount) } : undefined,
  usdValue: t.usd_value, journalEntryId: t.journal_entry_id ?? undefined, quoteId: t.quote_id ?? undefined, failureReason: t.failure_reason ?? undefined,
  meta: t.metadata ?? {}, createdAt: t.created_at, completedAt: t.completed_at ?? undefined,
  customerName: t.customer_name || undefined, customerTag: t.customer_tag || undefined,
});

const toLeg = (l: GLeg): JournalLeg => ({
  id: l.id, journalEntryId: l.journal_entry_id, ledgerAccountId: l.ledger_account_id, asset: asset(l.asset_code), side: l.side,
  amount: l.amount_decimal ?? fromUnits(l.asset_code, l.amount), usdRate: l.usd_rate, ngnRate: l.ngn_rate, memo: l.memo,
  accountNumber: l.account_number, accountName: l.account_name, accountCategory: l.account_category, createdAt: l.created_at,
});

const toJournal = (j: { entry: GEntry; legs: GLeg[] | null }): JournalView => ({
  entry: {
    id: j.entry.id, reference: j.entry.reference, transactionType: j.entry.transaction_type, description: j.entry.description, status: j.entry.status,
    reversesEntryId: j.entry.reverses_entry_id ?? undefined, businessTransactionId: j.entry.business_transaction_id ?? undefined,
    createdBy: j.entry.created_by, metadata: j.entry.metadata ?? {}, accountingDate: j.entry.accounting_date, postedAt: j.entry.posted_at,
  },
  legs: (j.legs ?? []).map(toLeg),
});

const toAccount = (a: GAccount): LedgerAccount => ({
  id: a.id, accountNumber: a.account_number, ownerKey: a.owner_key, code: a.code, name: a.name, category: a.category, normalSide: a.normal_side,
  asset: asset(a.asset_code), userId: a.user_id ?? undefined, accountType: a.account_type, allowNegative: a.allow_negative, status: a.status,
  balance: a.balance, createdAt: a.created_at,
});

// ── Customers ────────────────────────────────────────────────────────────────
export type CustomerFilters = { q?: string; kyc?: string; status?: string; label?: string; page: number };

export async function listCustomers(f: CustomerFilters) {
  await requirePerm("customers.view");
  const p = await get<GPage<GCustomer>>("/customers", { search: f.q, kyc: f.kyc, status: f.status, label: f.label, page: f.page });
  return { ...pageOf(p, toCustomer), now: Date.now() };
}

/** ⌘K quick jump. */
export async function quickSearch(q: string) {
  await requirePerm("customers.view");
  const term = q.trim().replace(/^@/, "").slice(0, 64);
  if (term.length < 2) return [];
  const p = await get<GPage<GCustomer>>("/customers", { search: term });
  return (p.rows ?? []).slice(0, 8).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, tag: c.tag, email: c.email, kycTier: c.kyc_tier, status: c.status }));
}

type GDevice = { id: string; name: string; platform: string; model: string; app_version: string; status: string; last_seen_at: string | null; activated_at: string | null; created_at: string };
type GCard = { id: string; label: string; network: string; last_four: string; currency: string; frozen: boolean; status: string; design_finish: string; created_at: string };

export async function getCustomer(id: string): Promise<Customer | null> {
  await requirePerm("customers.view");
  const d = await getOrNull<{ customer: GCustomer; balances: { account: string; account_number: string; asset: string; balance: string }[] | null; devices: GDevice[] | null; cards: GCard[] | null; tx_count: number; address: string; date_of_birth: string }>(`/customers/${encodeURIComponent(id)}`);
  if (!d) return null;
  return {
    ...toCustomer(d.customer),
    address: d.address, dob: d.date_of_birth, txCount: d.tx_count, fetchedAt: Date.now(),
    balances: (d.balances ?? []).map((b) => ({ account: b.account, accountNumber: b.account_number, asset: asset(b.asset), balance: b.balance })),
    devices: (d.devices ?? []).map((v) => ({ id: v.id, name: v.name, platform: v.platform, model: v.model, appVersion: v.app_version, status: v.status, lastSeenAt: v.last_seen_at, activatedAt: v.activated_at, createdAt: v.created_at })),
    cards: (d.cards ?? []).map((k) => ({ id: k.id, label: k.label, network: k.network, last4: k.last_four, currency: k.currency, frozen: k.frozen, status: k.status, designFinish: k.design_finish, createdAt: k.created_at })),
  };
}

type GCheck = { id: string; check_type: string; status: string; provider: string; reference: string; document_type: string | null; document_masked: string | null; match_score: number | null };
type GSubmission = {
  id: string; user_id: string; tier: number; status: string; reason: string | null; submitted_at: string; decided_at: string | null; decided_by: string | null;
  attempt: number | null; previous_reason: string | null; checks: GCheck[] | null;
  customer_name: string; customer_tag: string; customer_email: string; current_tier: number;
};
const toSubmission = (v: GSubmission): VerificationSubmission => ({
  id: v.id, customerId: v.user_id, tier: v.tier, status: (["pending", "approved", "rejected"].includes(v.status) ? v.status : "pending") as VerificationSubmission["status"],
  reason: v.reason || undefined, submittedAt: v.submitted_at, decidedAt: v.decided_at ?? undefined, decidedBy: v.decided_by ?? undefined,
  attempt: v.attempt ?? 1, previousReason: v.previous_reason || undefined,
  checks: (v.checks ?? []).map((c) => ({
    id: c.id, check: c.check_type, status: c.status, provider: c.provider, reference: c.reference,
    documentType: c.document_type ?? undefined, documentMasked: c.document_masked ?? undefined, matchScore: c.match_score ?? undefined,
  })),
  customerName: v.customer_name, customerTag: v.customer_tag, customerEmail: v.customer_email, currentTier: v.current_tier,
});

/** Every request this customer sent, newest first. */
export async function getCustomerVerifications(id: string) {
  await requirePerm("kyc.view");
  const p = await get<GPage<GSubmission> | GSubmission[]>(`/customers/${encodeURIComponent(id)}/verifications`);
  const rows = Array.isArray(p) ? p : (p.rows ?? []);
  return rows.map(toSubmission).sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
}

export async function getCustomerTransactions(id: string, f: { category?: string; page: number }) {
  await requirePerm("transactions.view");
  const p = await get<GPage<GTx>>(`/customers/${encodeURIComponent(id)}/transactions`, { category: f.category, page: f.page });
  return pageOf(p, toTx);
}

export async function getCustomerApiTrail(id: string, f: TrailFilters) {
  await requirePerm("api.view");
  const p = await get<GPage<GApi>>(`/customers/${encodeURIComponent(id)}/api-requests`, trailQuery(f));
  return pageOf(p, toApi);
}

// ── Transactions ─────────────────────────────────────────────────────────────
export type TxFilters = { category?: string; type?: string; status?: string; asset?: string; q?: string; from?: string; to?: string; page: number };

export async function listTransactions(f: TxFilters) {
  await requirePerm("transactions.view");
  const p = await get<GPage<GTx>>("/transactions", { category: f.category, type: f.type, status: f.status, asset: f.asset, search: f.q, from: f.from, to: f.to, page: f.page });
  return pageOf(p, toTx);
}

type GSwapLeg = { step: number; from_asset: string; to_asset: string; from_amount: string; to_amount: string; rate: string; provider_id: string; via_ngn_rail: boolean; created_at: string };

export async function getTransaction(id: string): Promise<TxDetail | null> {
  await requirePerm("transactions.view");
  const d = await getOrNull<{ transaction: GTx; customer: GCustomer | null; journal: { entry: GEntry; legs: GLeg[] | null }[] | null; swap_legs: GSwapLeg[] | null }>(`/transactions/${encodeURIComponent(id)}`);
  if (!d) return null;
  const customer = d.customer ? toCustomer(d.customer) : null;
  const tx = toTx(d.transaction);
  return {
    tx: customer ? { ...tx, customerName: `${customer.firstName} ${customer.lastName}`, customerTag: customer.tag } : tx,
    customer,
    journal: (d.journal ?? []).map(toJournal),
    swapLegs: (d.swap_legs ?? []).map((l): SwapLeg => ({
      step: l.step, fromAsset: asset(l.from_asset), toAsset: asset(l.to_asset), from: fromUnits(l.from_asset, l.from_amount), to: fromUnits(l.to_asset, l.to_amount),
      rate: l.rate, providerId: l.provider_id, viaNgnRail: l.via_ngn_rail, createdAt: l.created_at,
    })),
  };
}

// ── Currencies & rates ───────────────────────────────────────────────────────
type GAsset = { code: string; name: string; kind: "fiat" | "crypto"; symbol: string; decimal_places: number; conversion_provider_id: string; price_source: string; display_order: number; enabled: boolean; version: number };
type GRates = { version: number; collected_at: string; is_stale: boolean; rates: Record<string, { usd: string; ngn: string; change_today_percent: string }> | null };

const toRates = (r: GRates): RatesSnapshot => ({
  version: r.version, collectedAt: r.collected_at, isStale: r.is_stale,
  rates: Object.entries(r.rates ?? {}).map(([code, v]) => ({ asset: asset(code), usd: v.usd, ngn: v.ngn, changePct: v.change_today_percent })),
});

export async function listRates() {
  await requirePerm("currencies.view");
  return toRates(await get<GRates>("/rates"));
}

export async function rateHistory(code: string, hours = 24): Promise<RatePoint[]> {
  await requirePerm("currencies.view");
  const rows = await get<{ usd_rate: string; ngn_rate: string; collected_at: string }[] | null>("/rates/history", { asset: code, hours });
  return (rows ?? []).map((r) => ({ usd: r.usd_rate, ngn: r.ngn_rate, at: r.collected_at })).sort((a, b) => (a.at < b.at ? -1 : 1));
}

/**
 * Assets from the backend with the latest rate. The vault balance (listInventory)
 * and the provider (listProviders) stream into each card separately.
 */
export async function listCurrencies() {
  await requirePerm("currencies.view");
  const [assets, rates] = await Promise.all([get<GAsset[] | null>("/currencies"), get<GRates>("/rates").then(toRates).catch(() => null)]);
  const rate = new Map(rates?.rates.map((r) => [r.asset, r]) ?? []);
  return {
    collectedAt: rates?.collectedAt ?? null,
    isStale: rates?.isStale ?? true,
    rows: (assets ?? []).map((x) => ({
      code: asset(x.code), name: x.name, kind: x.kind, symbol: x.symbol, decimals: x.decimal_places, enabled: x.enabled, providerId: x.conversion_provider_id, priceSource: x.price_source, version: x.version,
      usd: rate.get(asset(x.code))?.usd ?? null, ngn: rate.get(asset(x.code))?.ngn ?? null, changePct: rate.get(asset(x.code))?.changePct ?? null,
    })),
  };
}

// ── Pricing ──────────────────────────────────────────────────────────────────
type GMargin = { asset_code: string; buy_margin_percent: string; sell_margin_percent: string; version: number; updated_by: string; updated_at: string };
type GFee = { transaction_type: string; category: string; fee_percent: string; flat_fee: string; flat_fee_asset: string; maximum_fee: string | null; active: boolean; version: number; updated_by: string; updated_at: string };

export const toMargin = (m: GMargin): RateMargin => ({ asset: asset(m.asset_code), buyPct: m.buy_margin_percent, sellPct: m.sell_margin_percent, version: m.version, updatedBy: m.updated_by, updatedAt: m.updated_at });

/** Fee amounts are stored with 8 decimals; show them at the fee asset's precision. */
const trimTo = (value: string, decimals: number) => {
  const [i, f = ""] = value.split(".");
  return decimals > 0 ? `${i}.${(f + "0".repeat(decimals)).slice(0, decimals)}` : i;
};
export const toFee = (f: GFee): TransactionFee => ({
  type: f.transaction_type, category: f.category as TxCategory, feePct: f.fee_percent, flatFeeAsset: asset(f.flat_fee_asset),
  flatFee: trimTo(f.flat_fee, assetInfo(f.flat_fee_asset).decimals), maxFee: f.maximum_fee === null ? null : trimTo(f.maximum_fee, assetInfo(f.flat_fee_asset).decimals),
  active: f.active, version: f.version, updatedBy: f.updated_by, updatedAt: f.updated_at,
});

export async function listMargins() {
  await requirePerm("markups.view");
  return ((await get<GMargin[] | null>("/rate-margins")) ?? []).map(toMargin);
}

export async function listFees() {
  await requirePerm("markups.view");
  return ((await get<GFee[] | null>("/transaction-fees")) ?? []).map(toFee);
}

// ── API trail ────────────────────────────────────────────────────────────────
type GApi = {
  id: number; request_id: string; actor_type: string; user_id: string | null; method: string; path: string; status: number; latency_ms: number;
  ip_address: string; device: string; transaction_id: string | null; request_body: string | null; error_message: string | null; created_at: string;
};
const toApi = (r: GApi): ApiRequest => ({
  id: String(r.id), requestId: r.request_id, actorType: r.actor_type, customerId: r.user_id ?? undefined, method: r.method, path: r.path, status: r.status,
  latencyMs: r.latency_ms, ip: r.ip_address, device: r.device, at: r.created_at, txId: r.transaction_id ?? undefined,
  request: r.request_body ?? undefined, error: r.error_message ?? undefined,
});
export type TrailRow = ApiRequest;
export const statusClass = (s: number) => (s >= 500 ? "5xx" : s >= 400 ? "4xx" : "2xx");

export type TrailFilters = { status?: string; method?: string; path?: string; minLatency?: number; page: number };
const trailQuery = (f: TrailFilters) => ({ status: f.status, method: f.method, path: f.path, min_latency: f.minLatency, page: f.page });

export async function listApiTrail(f: TrailFilters & { customerId?: string }) {
  await requirePerm("api.view");
  const p = await get<GPage<GApi>>("/api-requests", { ...trailQuery(f), customer_id: f.customerId });
  return pageOf(p, toApi);
}

// ── Inventory & treasury ─────────────────────────────────────────────────────
/** Company accounts per asset: vault (money we hold), cashpoint escrow, payouts in transit. */
export async function listInventory() {
  await requirePerm("inventory.view");
  return ((await get<GAccount[] | null>("/inventory")) ?? []).map(toAccount);
}

/** Journal legs on the company vault accounts. null = the backend route isn't live yet. */
export async function listInventoryEntries(f: { asset?: string; page: number }) {
  await requirePerm("inventory.view");
  const p = await getOrNull<GPage<GLeg>>("/inventory/entries", { asset: f.asset, page: f.page });
  return p ? pageOf(p, toLeg) : null;
}

type GFunding = {
  id: string; asset_code: string; amount: string; amount_decimal?: string; external_reference: string; note: string; status?: string;
  requested_by: string; requested_by_name: string; approved_by?: string | null; approved_by_name?: string; decided_at?: string | null;
  rejection_reason?: string; journal_entry_id: string; created_at: string;
};
const toFunding = (f: GFunding): TreasuryFunding => ({
  id: f.id, asset: asset(f.asset_code), amount: f.amount_decimal ?? fromUnits(f.asset_code, f.amount), externalReference: f.external_reference, note: f.note,
  // Older rows (before the two-person check) have no status: they were posted on creation.
  status: (f.status || (f.journal_entry_id ? "approved" : "pending")) as TreasuryFunding["status"],
  requestedBy: f.requested_by, requestedByName: f.requested_by_name, approvedBy: f.approved_by ?? undefined, approvedByName: f.approved_by_name || undefined,
  decidedAt: f.decided_at ?? undefined, rejectionReason: f.rejection_reason || undefined, journalEntryId: f.journal_entry_id || undefined, createdAt: f.created_at,
});

export async function listTreasuryFundings(f: { status?: string; page: number }) {
  await requirePerm("inventory.view");
  return pageOf(await get<GPage<GFunding>>("/treasury-fundings", { status: f.status, page: f.page }), toFunding);
}

/** Per currency: vault, owed to customers, and free (the most admins may credit). null = the backend route isn't live yet. */
export async function listFreeFunds(): Promise<FreeFunds[] | null> {
  await requirePerm("inventory.view");
  const funds = await getOrNull<{ asset_code: string; vault: string; owed: string; free: string }[] | null>("/free-funds");
  return funds === null ? null : funds.map((f) => ({ asset: asset(f.asset_code), vault: f.vault, owed: f.owed, free: f.free }));
}

type GAdjustment = {
  id: string; user_id: string; kind: string; asset_code: string; amount: string; amount_decimal?: string; reason: string; status: string;
  requested_by: string; requested_by_name: string; approved_by_name?: string; decided_at?: string | null; rejection_reason?: string;
  transaction_id?: string; journal_entry_id?: string; customer_name?: string; customer_tag?: string; created_at: string;
};
const toAdjustment = (a: GAdjustment): CustomerAdjustment => ({
  id: a.id, kind: a.kind === "debit" ? "debit" : "credit", customerId: a.user_id, customerName: a.customer_name?.trim() || "—", customerTag: a.customer_tag ?? "",
  asset: asset(a.asset_code), amount: a.amount_decimal ?? fromUnits(a.asset_code, a.amount), reason: a.reason, status: a.status as CustomerAdjustment["status"],
  requestedBy: a.requested_by, requestedByName: a.requested_by_name, approvedByName: a.approved_by_name || undefined, decidedAt: a.decided_at ?? undefined,
  rejectionReason: a.rejection_reason || undefined, transactionId: a.transaction_id || undefined, journalEntryId: a.journal_entry_id || undefined, createdAt: a.created_at,
});

/** Manual credits & debits, newest first. customer narrows it to one customer. */
export async function listCustomerAdjustments(f: { status?: string; kind?: string; customer?: string; page: number }) {
  await requirePerm("inventory.view");
  return pageOf(await get<GPage<GAdjustment>>("/customer-adjustments", { status: f.status, kind: f.kind, customer: f.customer, page: f.page }), toAdjustment);
}

// ── Ledger ───────────────────────────────────────────────────────────────────
export async function listLedgerAccounts(f: { owner?: string; asset?: string }) {
  await requirePerm("ledger.view");
  return ((await get<GAccount[] | null>("/ledger-accounts", { owner: f.owner, asset: f.asset })) ?? []).map(toAccount);
}

export async function getAccountLegs(id: number, page: number) {
  await requirePerm("ledger.view");
  return pageOf(await get<GPage<GLeg>>(`/ledger-accounts/${id}/legs`, { page }), toLeg);
}

export async function getJournalEntry(id: string) {
  await requirePerm("ledger.view");
  const j = await getOrNull<{ entry: GEntry; legs: GLeg[] | null }>(`/journal-entries/${encodeURIComponent(id)}`);
  return j ? toJournal(j) : null;
}

type GSnapshot = { id: number; ledger_account_id: number; snapshot_date: string; closing: string; last_journal_leg_id: number; created_at: string; account_number: string; account_name: string; asset_code: string };

export async function listSnapshots(date?: string) {
  await requirePerm("ledger.view");
  const d = await get<{ date: string; snapshots: GSnapshot[] | null }>("/ledger-snapshots", { date });
  return {
    date: d.date,
    rows: (d.snapshots ?? []).map((s): LedgerSnapshot => ({
      id: s.id, ledgerAccountId: s.ledger_account_id, date: s.snapshot_date, accountNumber: s.account_number, accountName: s.account_name,
      asset: asset(s.asset_code), closing: s.closing, lastJournalLegId: s.last_journal_leg_id, createdAt: s.created_at,
    })),
  };
}

// ── Verifications queue ──────────────────────────────────────────────────────
const SUBMISSION_STATUSES = ["pending", "approved", "rejected"] as const;

/** One page of requests (the API sends them oldest first). */
export async function listVerificationQueue(f: { status?: string; page: number }) {
  await requirePerm("kyc.view");
  const p = await get<GPage<GSubmission>>("/verifications", { status: f.status || "pending", page: f.page });
  return { ...pageOf(p, toSubmission), now: Date.now() };
}

/** Requests per status for the tabs. Falls back to one /verifications read per status on older backends. */
export async function countVerifications(): Promise<Record<string, number>> {
  await requirePerm("kyc.view");
  const c = await tryGet<Record<string, number> | null>("/verifications/counts");
  if (c) return c.data ?? {};
  const totals = await Promise.all(SUBMISSION_STATUSES.map((s) => get<GPage<GSubmission>>("/verifications", { status: s }).then((x) => [s, x.total ?? 0] as const)));
  return Object.fromEntries(totals);
}

/** How many requests wait for a reviewer (the sidebar badge). 0 without kyc.view. */
export async function countPendingVerifications() {
  const a = await getAccess();
  if (!a.has("kyc.view")) return 0;
  return (await getOrNull<GPage<GSubmission>>("/verifications", { status: "pending" }))?.total ?? 0;
}

// ── Support ──────────────────────────────────────────────────────────────────
type GThread = {
  id: string; user_id: string; channel: string; subject: string; transaction_id: string | null; status: string; priority: string; unread_for_admin: number;
  created_at: string; updated_at: string; customer_name: string; customer_tag: string; preview?: string;
};
const toThread = (t: GThread): SupportThread => ({
  id: t.id, customerId: t.user_id, customerName: t.customer_name || "Customer", customerTag: t.customer_tag, channel: t.channel === "chat" ? "chat" : "ticket",
  subject: t.subject, txId: t.transaction_id ?? undefined, status: t.status as SupportThread["status"], priority: (t.priority || "normal") as SupportThread["priority"],
  unread: t.unread_for_admin ?? 0, preview: t.preview ?? "", createdAt: t.created_at, updatedAt: t.updated_at,
});

export async function listThreads(f: { status?: string; channel?: string }) {
  await requirePerm("support.view");
  const { data, meta } = await getWithMeta<GThread[] | null, { counts?: Partial<Record<"open" | "pending" | "resolved", number>> }>("/support-threads");
  const all = (data ?? []).map(toThread);
  const c = meta?.counts ?? {};
  const counts: Record<string, number> = { open: c.open ?? 0, pending: c.pending ?? 0, resolved: c.resolved ?? 0, unread: all.reduce((n, t) => n + t.unread, 0) };
  counts.all = counts.open + counts.pending + counts.resolved;
  return { rows: all.filter((t) => (!f.status || t.status === f.status) && (!f.channel || t.channel === f.channel)), counts };
}

export async function getThread(id: string) {
  const a = await requirePerm("support.view");
  const d = await getOrNull<{ thread: GThread; messages: { id: string; sender_type: string; author_name: string; body: string; created_at: string }[] | null }>(`/support-threads/${encodeURIComponent(id)}`);
  if (!d) return null;
  const thread = toThread(d.thread);
  const messages = (d.messages ?? []).map((m): SupportMessage => ({
    id: m.id, from: m.sender_type === "agent" ? "agent" : m.sender_type === "system" ? "system" : "customer", author: m.author_name, body: m.body, at: m.created_at,
  }));
  const tx = thread.txId && a.has("transactions.view") ? await getOrNull<{ transaction: GTx }>(`/transactions/${encodeURIComponent(thread.txId)}`) : null;
  return { thread, messages, tx: tx ? toTx(tx.transaction) : null };
}

// ── Audit ────────────────────────────────────────────────────────────────────
type GAudit = { id: string; admin_user_id: string; admin_name: string; action: string; target: string; summary: string; before_data: unknown; after_data: unknown; created_at: string };
const json = (v: unknown) => (v === null || v === undefined ? undefined : typeof v === "string" ? v : JSON.stringify(v));

export async function listAudit(f: { action?: string; page: number }) {
  await requirePerm("audit.view");
  const p = await get<GPage<GAudit>>("/audit-logs", { action: f.action, page: f.page });
  return pageOf(p, (a): AuditEvent => ({ id: a.id, adminId: a.admin_user_id, adminName: a.admin_name, action: a.action, target: a.target, summary: a.summary, before: json(a.before_data), after: json(a.after_data), at: a.created_at }));
}

// ── Overview ─────────────────────────────────────────────────────────────────
type GOverview = {
  as_of: string; customers: number; signups_7: number; kyc_pending: number; open_tickets: number; pending_all: number;
  transactions_24: number; failed_24: number; fail_rate_24: number; volume_1_usd: string; volume_7_usd: string;
  series: { day: string; volume_usd: string; count: number; failed: number }[] | null;
  by_category_7: { category: string; volume_usd: string; count: number }[] | null;
  failed_recent: GTx[] | null; inventory: GAccount[] | null;
};

// Each overview section reads its own endpoint. Older backends only serve the
// /overview aggregate: every fallback shares that one (cached) call.
const overview = () => get<GOverview>("/overview");

export async function getOverviewStats() {
  await requirePerm("overview.view");
  const o = (await tryGet<Omit<GOverview, "series" | "by_category_7" | "failed_recent" | "inventory">>("/overview/stats"))?.data ?? (await overview());
  return {
    asOf: o.as_of, customers: o.customers, signups7: o.signups_7, kycPending: o.kyc_pending, openTickets: o.open_tickets, pendingAll: o.pending_all,
    tx24: o.transactions_24, failed24: o.failed_24, failRate24: o.fail_rate_24, vol1: o.volume_1_usd, vol7: o.volume_7_usd,
  };
}

export async function getOverviewSeries() {
  await requirePerm("overview.view");
  const s = ((await tryGet<GOverview["series"]>("/overview/series")) ?? { data: (await overview()).series }).data;
  return (s ?? []).map((d) => ({ day: d.day.slice(0, 10), volumeUsd: d.volume_usd, count: d.count, failed: d.failed }));
}

export async function getOverviewByCategory() {
  await requirePerm("overview.view");
  const c = ((await tryGet<GOverview["by_category_7"]>("/overview/by-category")) ?? { data: (await overview()).by_category_7 }).data;
  return (c ?? []).map((x) => ({ category: x.category as TxCategory, volumeUsd: x.volume_usd, count: x.count }));
}

export async function getOverviewFailures() {
  await requirePerm("overview.view");
  const f = ((await tryGet<GOverview["failed_recent"]>("/overview/failures")) ?? { data: (await overview()).failed_recent }).data;
  return (f ?? []).map(toTx);
}

/** Company vaults for the overview: /inventory when the admin may see it, else what the aggregate carries. */
export async function getOverviewVaults() {
  const a = await requirePerm("overview.view");
  const accounts = a.has("inventory.view") ? await get<GAccount[] | null>("/inventory") : (await overview()).inventory;
  return (accounts ?? []).map(toAccount).filter((v) => v.code === "company_vault");
}

// ── Providers, card designs, jobs ────────────────────────────────────────────
type GProvider = { id: string; slug: string; name: string; category: string; uses_ngn_rail: boolean; supports_direct_conversion: boolean; is_simulator: boolean; enabled: boolean; version: number; updated_at: string; assets: string[] | null };

export async function listProviders() {
  await requirePerm("providers.view");
  return ((await get<GProvider[] | null>("/providers")) ?? []).map((p): Provider => ({
    id: p.id, slug: p.slug, name: p.name, category: p.category, usesNgnRail: p.uses_ngn_rail, supportsDirectConversion: p.supports_direct_conversion,
    isSimulator: p.is_simulator, enabled: p.enabled, assets: (p.assets ?? []).map(asset), version: p.version, updatedAt: p.updated_at,
  }));
}

type GService = { code: string; name: string; description: string; enabled: boolean; disabled_message: string | null; version: number; updated_at: string };

/** Every customer-facing service with its on/off switch, in the API's fixed order. */
export async function listServices() {
  await requirePerm("services.view");
  return ((await get<GService[] | null>("/services")) ?? []).map((x): ServiceSwitch => ({
    code: x.code, name: x.name, description: x.description, enabled: x.enabled, disabledMessage: x.disabled_message ?? "", version: x.version, updatedAt: x.updated_at,
  }));
}

type GDesign = { id: string; kind: string; name: string; finish: string; hex_color: string | null; pattern: string | null; enabled: boolean; sort_order: number; version: number; updated_at: string };
const toDesign = (d: GDesign): CardDesign => ({
  id: d.id, kind: d.kind as CardDesign["kind"], name: d.name, finish: d.finish, hexColor: d.hex_color, pattern: d.pattern, enabled: d.enabled, sortOrder: d.sort_order, version: d.version, updatedAt: d.updated_at,
});

export async function listCardDesigns() {
  await requirePerm("card_designs.manage");
  const c = await get<{ themes: GDesign[] | null; swatches: GDesign[] | null; patterns: GDesign[] | null }>("/card-designs");
  return [...(c.themes ?? []), ...(c.swatches ?? []), ...(c.patterns ?? [])].map(toDesign);
}

type GJobs = {
  schedule: { name: string; cron: string }[] | null;
  cron_runs: { id: number; job_name: string; window_key: string; status: string; message: string; started_at: string; finished_at: string | null }[] | null;
  queues: { name: string; pending: number; active: number; scheduled: number; retry: number; failed: number; processed_today: number }[] | null;
  failed_jobs: { id: string; queue: string; type: string; error: string; failed_at: string }[] | null;
};

/** One part of the jobs board from its own route, or from the /jobs aggregate (one shared call) on older backends. */
async function jobsPart<K extends keyof GJobs>(path: string, k: K): Promise<NonNullable<GJobs[K]>> {
  await requirePerm("jobs.view");
  const r = (await tryGet<GJobs[K]>(path)) ?? { data: (await get<GJobs>("/jobs"))[k] };
  return (r.data ?? []) as NonNullable<GJobs[K]>;
}

export async function listJobSchedule(): Promise<Jobs["schedule"]> {
  return jobsPart("/jobs/schedule", "schedule");
}

export async function listCronRuns(): Promise<Jobs["cronRuns"]> {
  return (await jobsPart("/jobs/runs", "cron_runs")).map((r) => ({ id: r.id, job: r.job_name, window: r.window_key, status: r.status, message: r.message, startedAt: r.started_at, finishedAt: r.finished_at }));
}

export async function listQueues(): Promise<Jobs["queues"]> {
  return (await jobsPart("/jobs/queues", "queues")).map((q) => ({ name: q.name, pending: q.pending, active: q.active, scheduled: q.scheduled, retry: q.retry, failed: q.failed, processedToday: q.processed_today }));
}

export async function listFailedJobs(): Promise<Jobs["failed"]> {
  return (await jobsPart("/jobs/failed", "failed_jobs")).map((f) => ({ id: f.id, queue: f.queue, type: f.type, error: f.error, failedAt: f.failed_at }));
}

// ── Team ─────────────────────────────────────────────────────────────────────
type GMember = { id: string; name: string; email: string; color: string; status: string; permissions: string[] | null; last_login_at: string | null; created_at: string; version: number };

export async function listTeam() {
  await requirePerm("team.view");
  const rows = (await get<GMember[] | null>("/team-members")) ?? [];
  return rows
    .map((m) => {
      const permissions = (m.permissions ?? []) as Permission[];
      return {
        id: m.id, name: m.name, email: m.email, color: asAvatarColor(m.color), status: (m.status === "active" ? "active" : "suspended") as "active" | "suspended",
        permissions, role: detectRole(normalisePerms(permissions)), lastLoginAt: m.last_login_at ?? undefined, createdAt: m.created_at, version: m.version,
      };
    })
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || (a.createdAt < b.createdAt ? -1 : 1));
}
export type TeamMember = Awaited<ReturnType<typeof listTeam>>[number];
