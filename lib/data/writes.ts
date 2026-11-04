import "server-only";
import { del, patch, post, put } from "@/lib/api/client";

// Write side of the backend seam. Server actions authorise + validate, then
// call these. Each call is one Go admin API write; the API audits it, so
// nothing here writes an audit row itself. Every write carries a fresh
// Idempotency-Key (added by the client) unless the caller passes one.

type Key = { idempotencyKey?: string };

// ── Customers & KYC ──────────────────────────────────────────────────────────
export const decideVerification = (id: string, decision: "approve" | "reject", reason: string | undefined, k: Key = {}) =>
  post(`/verifications/${encodeURIComponent(id)}/decisions`, { decision, reason: reason ?? "" }, k);

export const setCustomerStatus = (id: string, status: "active" | "frozen", reason: string, version: number | undefined, k: Key = {}) =>
  patch(`/customers/${encodeURIComponent(id)}/status`, { status, reason, version: version ?? 0 }, k);

export const setCustomerLabels = (id: string, labels: string[], k: Key = {}) => put(`/customers/${encodeURIComponent(id)}/labels`, { labels }, k);

// ── Pricing ──────────────────────────────────────────────────────────────────
export type MarginInput = { asset: string; buyPct: string; sellPct: string; version: number };
export const saveMargin = (m: MarginInput, k: Key = {}) =>
  put(`/rate-margins/${encodeURIComponent(m.asset)}`, { buy_margin_percent: m.buyPct, sell_margin_percent: m.sellPct, version: m.version }, k);

export type FeeInput = { type: string; feePct: string; flatFee: string; flatFeeAsset: string; maxFee: string | null; active: boolean; version: number };
export const saveFee = (f: FeeInput, k: Key = {}) =>
  put(`/transaction-fees/${encodeURIComponent(f.type)}`, { fee_percent: f.feePct, flat_fee: f.flatFee, flat_fee_asset: f.flatFeeAsset, maximum_fee: f.maxFee, active: f.active, version: f.version }, k);

// ── Treasury (two-person check) ──────────────────────────────────────────────
export const requestTreasuryFunding = (input: { asset: string; amount: string; externalReference: string; note?: string }, k: Key = {}) =>
  post<{ id: string; status?: string }>("/treasury-fundings", { asset: input.asset, amount: input.amount, external_reference: input.externalReference, note: input.note ?? "" }, k);

export const approveTreasuryFunding = (id: string, k: Key = {}) => post(`/treasury-fundings/${encodeURIComponent(id)}/approve`, {}, k);
export const rejectTreasuryFunding = (id: string, reason: string, k: Key = {}) => post(`/treasury-fundings/${encodeURIComponent(id)}/reject`, { reason }, k);

// ── Manual customer credits & debits (request → a super admin approves) ─────
export const requestCustomerAdjustment = (customerId: string, input: { kind: "credit" | "debit"; asset: string; amount: string; reason: string }, k: Key = {}) =>
  post<{ id: string; status?: string }>(`/customers/${encodeURIComponent(customerId)}/adjustments`, input, k);

export const approveCustomerAdjustment = (id: string, k: Key = {}) => post(`/customer-adjustments/${encodeURIComponent(id)}/approve`, {}, k);
export const rejectCustomerAdjustment = (id: string, reason: string, k: Key = {}) => post(`/customer-adjustments/${encodeURIComponent(id)}/reject`, { reason }, k);

// ── Providers & card designs ─────────────────────────────────────────────────
export const updateProvider = (id: string, changes: { usesNgnRail?: boolean; enabled?: boolean; supportsDirectConversion?: boolean }, version: number, k: Key = {}) =>
  put(`/providers/${encodeURIComponent(id)}`, { uses_ngn_rail: changes.usesNgnRail, enabled: changes.enabled, supports_direct_conversion: changes.supportsDirectConversion, version }, k);

// Only the kind's own field carries a value: themes `finish`, swatches `hex_color`, patterns `pattern`.
export type DesignInput = { id: string; kind: "theme" | "swatch" | "pattern"; name: string; finish: string; hexColor: string | null; pattern: string | null; enabled: boolean; sortOrder: number };
const designBody = (d: DesignInput) => ({ id: d.id, kind: d.kind, name: d.name, finish: d.finish, hex_color: d.hexColor, pattern: d.pattern, enabled: d.enabled, sort_order: d.sortOrder });
/** The API keeps the given id; 409 DESIGN_EXISTS when the id or the kind+key is taken. */
export const createCardDesign = (d: DesignInput, k: Key = {}) => post("/card-designs", designBody(d), k);
/** `version` must match the row's (stale → 409). */
export const updateCardDesign = (d: DesignInput, version: number, k: Key = {}) => put(`/card-designs/${encodeURIComponent(d.id)}`, { ...designBody(d), version }, k);
/** Soft disable: the app stops offering it, cards wearing it keep it. */
export const disableCardDesign = (id: string, version: number, k: Key = {}) => del(`/card-designs/${encodeURIComponent(id)}`, { query: { version }, ...k });
export const enableCardDesign = (id: string, version: number, k: Key = {}) => post(`/card-designs/${encodeURIComponent(id)}/enable`, { version }, k);

// ── Jobs ─────────────────────────────────────────────────────────────────────
export const retryJob = (queue: string, id: string, k: Key = {}) => post(`/jobs/${encodeURIComponent(queue)}/${encodeURIComponent(id)}/retry`, {}, k);
export const runDailySnapshot = (k: Key = {}) => post("/jobs/daily-snapshot/run", {}, k);

// ── Support ──────────────────────────────────────────────────────────────────
export const replyToThread = (id: string, body: string, k: Key = {}) => post(`/support-threads/${encodeURIComponent(id)}/messages`, { body }, k);
export const setThreadStatus = (id: string, status: "open" | "pending" | "resolved", k: Key = {}) => patch(`/support-threads/${encodeURIComponent(id)}/status`, { status }, k);

// ── Team ─────────────────────────────────────────────────────────────────────
type Member = { id: string; name: string; email: string; temporary_password?: string };
export const createTeammate = (input: { name: string; email: string; color: string; permissions: string[] }, k: Key = {}) => post<Member>("/team-members", input, k);
export const updateTeammate = (id: string, changes: { name?: string; color?: string; status?: "active" | "suspended"; permissions?: string[]; resetPassword?: boolean; version: number }, k: Key = {}) =>
  patch<Member>(`/team-members/${encodeURIComponent(id)}`, { name: changes.name, color: changes.color, status: changes.status, permissions: changes.permissions, reset_password: changes.resetPassword ?? false, version: changes.version }, k);
export const removeTeammate = (id: string, k: Key = {}) => del(`/team-members/${encodeURIComponent(id)}`, k);

// ── Session ──────────────────────────────────────────────────────────────────
export const endSession = (token: string) => del("/sessions/current", { token });
