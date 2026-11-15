"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ApiError, get, toActionResult, type ActionResult } from "@/lib/api/client";
import { authorize } from "@/lib/auth/current";
import { getTransaction, listRates, listThreads, quickSearch, rateHistory } from "@/lib/data/repo";
import * as writes from "@/lib/data/writes";
import { CUSTOMER_LABELS, assetInfo } from "@/lib/domain/catalog";
import { PATTERN_KEYS, THEME_KEYS, designId } from "@/lib/domain/card-looks";
import { cleanDecimal } from "@/lib/domain/money";
import { fmtMoney } from "@/lib/format";

// Every action: authorise (permissions re-read from the API) → validate (zod)
// → one Go API write (the API audits it) → refresh() so the admin sees it.
// Errors from the API come back as { ok: false, message } via toActionResult.

export type { ActionResult };

const done = (message: string): ActionResult => {
  refresh();
  return { ok: true, message, at: Date.now() };
};
const invalid = (e: z.ZodError): ActionResult => ({ ok: false, message: e.issues[0]?.message ?? "Check the form.", at: Date.now() });

// ── Treasury funding (request → a different admin approves) ──────────────────
const Funding = z.object({
  asset: z.string().trim().toUpperCase().min(2, "Pick an asset.").max(10),
  providerId: z.string().trim().max(26).optional(),
  amount: z.string().trim().min(1, "Enter an amount."),
  externalReference: z.string().trim().min(3, "Add the bank or provider reference (3+ characters).").max(64),
  note: z.string().trim().max(200).optional(),
});

export async function requestFunding(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await authorize("inventory.topup");
    const p = Funding.safeParse({ asset: formData.get("asset"), providerId: formData.get("providerId") || undefined, amount: formData.get("amount"), externalReference: formData.get("externalReference"), note: formData.get("note") || undefined });
    if (!p.success) return invalid(p.error);
    const amount = cleanDecimal(p.data.amount, assetInfo(p.data.asset).decimals);
    if (!amount || !/[1-9]/.test(amount)) return { ok: false, message: `Enter a positive ${p.data.asset} amount with at most ${assetInfo(p.data.asset).decimals} decimals.`, at: Date.now() };
    await writes.requestTreasuryFunding({ asset: p.data.asset, providerId: p.data.providerId, amount, externalReference: p.data.externalReference, note: p.data.note }, { idempotencyKey: String(formData.get("idempotencyKey") || "") || undefined });
    return done(`Requested ${fmtMoney(p.data.asset, amount)}. Another admin must approve it before it's posted.`);
  } catch (e) {
    return toActionResult(e);
  }
}

const FundingDecision = z.object({ id: z.string().min(1).max(40), decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(200).optional() });

export async function decideFunding(id: string, decision: "approve" | "reject", reason?: string): Promise<ActionResult> {
  try {
    await authorize("inventory.approve");
    const p = FundingDecision.safeParse({ id, decision, reason });
    if (!p.success) return invalid(p.error);
    if (p.data.decision === "reject" && (p.data.reason?.length ?? 0) < 3) return { ok: false, message: "Give a reason for rejecting (3+ characters).", at: Date.now() };
    if (p.data.decision === "approve") await writes.approveTreasuryFunding(p.data.id);
    else await writes.rejectTreasuryFunding(p.data.id, p.data.reason ?? "");
    return done(p.data.decision === "approve" ? "Approved and posted to the vault." : "Request rejected.");
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Manual customer credits & debits (request → a super admin approves) ──────
const Adjustment = z.object({
  customerId: z.string().min(1).max(40),
  kind: z.enum(["credit", "debit"]),
  asset: z.string().trim().toUpperCase().min(2, "Pick a currency.").max(10),
  amount: z.string().trim().min(1, "Enter an amount."),
  reason: z.string().trim().min(3, "Say why (3+ characters). It goes to the audit log.").max(200),
});

export async function requestAdjustment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await authorize("adjustments.request");
    const p = Adjustment.safeParse({ customerId: formData.get("customerId"), kind: formData.get("kind"), asset: formData.get("asset"), amount: formData.get("amount"), reason: formData.get("reason") });
    if (!p.success) return invalid(p.error);
    const amount = cleanDecimal(p.data.amount, assetInfo(p.data.asset).decimals);
    if (!amount || !/[1-9]/.test(amount)) return { ok: false, message: `Enter a positive ${p.data.asset} amount with at most ${assetInfo(p.data.asset).decimals} decimals.`, at: Date.now() };
    await writes.requestCustomerAdjustment(p.data.customerId, { kind: p.data.kind, asset: p.data.asset, amount, reason: p.data.reason }, { idempotencyKey: String(formData.get("idempotencyKey") || "") || undefined });
    return done(`${p.data.kind === "credit" ? "Credit" : "Debit"} of ${fmtMoney(p.data.asset, amount)} requested. A super admin must approve it before it's posted.`);
  } catch (e) {
    return toActionResult(e);
  }
}

export async function decideAdjustment(id: string, decision: "approve" | "reject", reason?: string): Promise<ActionResult> {
  try {
    await authorize("adjustments.approve");
    const p = FundingDecision.safeParse({ id, decision, reason });
    if (!p.success) return invalid(p.error);
    if (p.data.decision === "reject" && (p.data.reason?.length ?? 0) < 3) return { ok: false, message: "Give a reason for rejecting (3+ characters).", at: Date.now() };
    if (p.data.decision === "approve") await writes.approveCustomerAdjustment(p.data.id);
    else await writes.rejectCustomerAdjustment(p.data.id, p.data.reason ?? "");
    return done(p.data.decision === "approve" ? "Approved and posted to the customer's wallet." : "Request rejected.");
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Rate margins & transaction fees ──────────────────────────────────────────
const pct = (max: number) => z.string().trim().regex(/^\d+(\.\d{1,6})?$/, "Percentages are plain numbers, up to 6 decimals.").refine((v) => Number(v) <= max, `Keep percentages at or under ${max}%.`);
const amount = z.string().trim().regex(/^\d+(\.\d{1,8})?$/, "Amounts are plain numbers, up to 8 decimals.");

const Margins = z.array(z.object({ asset: z.string().min(2).max(10), buyPct: pct(25), sellPct: pct(25), version: z.number().int().min(0) })).max(50);

export async function saveMargins(rows: unknown): Promise<ActionResult> {
  try {
    await authorize("markups.edit");
    const p = Margins.safeParse(rows);
    if (!p.success) return invalid(p.error);
    if (!p.data.length) return { ok: true, message: "No changes to save.", at: Date.now() };
    for (const m of p.data) await writes.saveMargin(m);
    return done(`Saved ${p.data.length} margin${p.data.length > 1 ? "s" : ""}.`);
  } catch (e) {
    return toActionResult(e);
  }
}

const Fees = z
  .array(z.object({ type: z.string().min(2).max(40), feePct: pct(10), flatFee: amount, flatFeeAsset: z.string().min(2).max(10), maxFee: amount.nullable(), active: z.boolean(), version: z.number().int().min(0) }))
  .max(50);

export async function saveFees(rows: unknown): Promise<ActionResult> {
  try {
    await authorize("markups.edit");
    const p = Fees.safeParse(rows);
    if (!p.success) return invalid(p.error);
    if (!p.data.length) return { ok: true, message: "No changes to save.", at: Date.now() };
    for (const f of p.data) await writes.saveFee(f);
    return done(`Saved ${p.data.length} fee rule${p.data.length > 1 ? "s" : ""}.`);
  } catch (e) {
    return toActionResult(e);
  }
}

const ReferralShare = z.object({ sharePercent: pct(100), version: z.coerce.number().int().min(0) });

/** The referral share: the percent of what Tribe earns on an invited customer's transaction paid to the inviter. */
export async function saveReferralShare(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await authorize("markups.edit");
    const p = ReferralShare.safeParse({ sharePercent: formData.get("sharePercent"), version: formData.get("version") });
    if (!p.success) return invalid(p.error);
    await writes.saveReferralShare(p.data.sharePercent, p.data.version, { idempotencyKey: String(formData.get("idempotencyKey") || "") || undefined });
    return done(`Referral share set to ${p.data.sharePercent}%. It applies to transactions from now on.`);
  } catch (e) {
    return toActionResult(e);
  }
}

// ── KYC decisions ────────────────────────────────────────────────────────────
const Decision = z
  .object({ id: z.string().min(1), decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(255).optional() })
  .refine((d) => d.decision === "approve" || (d.reason?.length ?? 0) >= 3, { message: "Give a reason for rejecting (3+ characters). The customer sees it.", path: ["reason"] });

export async function decideVerification(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await authorize("kyc.decide");
    const p = Decision.safeParse({ id: formData.get("id"), decision: formData.get("decision"), reason: formData.get("reason") || undefined });
    if (!p.success) return invalid(p.error);
    await writes.decideVerification(p.data.id, p.data.decision, p.data.reason);
    return done(p.data.decision === "approve" ? "Request approved. The customer moves up a tier." : "Request rejected. The customer sees your reason.");
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Customer status & labels ─────────────────────────────────────────────────
const Status = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "frozen"]),
  reason: z.string().trim().min(3, "Give a reason (min 3 characters).").max(200),
  version: z.coerce.number().int().min(0).optional(),
});

export async function setCustomerStatus(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await authorize("customers.freeze");
    const p = Status.safeParse({ id: formData.get("id"), status: formData.get("status"), reason: formData.get("reason"), version: formData.get("version") || undefined });
    if (!p.success) return invalid(p.error);
    await writes.setCustomerStatus(p.data.id, p.data.status, p.data.reason, p.data.version);
    return done(p.data.status === "frozen" ? "Account frozen." : "Account unfrozen.");
  } catch (e) {
    return toActionResult(e);
  }
}

const Labels = z.object({
  id: z.string().min(1),
  labels: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,24}$/, "Labels use 2–24 letters, numbers or dashes.")).max(6, "Up to 6 labels."),
});

export async function setCustomerLabels(id: string, labels: string[]): Promise<ActionResult> {
  try {
    await authorize("customers.labels");
    const known = new Map(CUSTOMER_LABELS.map((l) => [l.toLowerCase(), l]));
    const p = Labels.safeParse({ id, labels });
    if (!p.success) return invalid(p.error);
    await writes.setCustomerLabels(id, [...new Set(p.data.labels.map((l) => known.get(l) ?? l))]);
    return done("Labels updated.");
  } catch (e) {
    return toActionResult(e);
  }
}

// ── ⌘K palette ───────────────────────────────────────────────────────────────
export async function searchCustomers(q: string) {
  if (typeof q !== "string") return [];
  const me = await authorize();
  if (!me.perms.includes("customers.view")) return [];
  return quickSearch(q);
}

// ── Transaction quick view (drawer) ──────────────────────────────────────────
export async function previewTransaction(id: string) {
  if (typeof id !== "string" || id.length > 60) return null;
  await authorize("transactions.view");
  return getTransaction(id);
}

// ── Support inbox ────────────────────────────────────────────────────────────
const Reply = z.object({ threadId: z.string().min(1).max(40), body: z.string().trim().min(1, "Type a message.").max(2000) });

export async function replySupport(threadId: string, body: string): Promise<ActionResult> {
  try {
    await authorize("support.reply");
    const p = Reply.safeParse({ threadId, body });
    if (!p.success) return invalid(p.error);
    await writes.replyToThread(p.data.threadId, p.data.body);
    return done("Sent");
  } catch (e) {
    return toActionResult(e);
  }
}

export async function setSupportStatus(threadId: string, status: "open" | "pending" | "resolved"): Promise<ActionResult> {
  try {
    await authorize("support.resolve");
    if (!["open", "pending", "resolved"].includes(status) || typeof threadId !== "string") return { ok: false, message: "Invalid status.", at: Date.now() };
    await writes.setThreadStatus(threadId, status);
    return done(status === "resolved" ? "Resolved ✅" : `Marked ${status}`);
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Currencies ───────────────────────────────────────────────────────────────
const NewCurrency = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/, "Use 2 to 10 capital letters or digits for the code."),
  name: z.string().trim().min(1, "Enter a name.").max(64),
  kind: z.enum(["fiat", "crypto"]),
  symbol: z.string().trim().max(8, "Keep the symbol to 8 characters."),
  decimalPlaces: z.number().int().min(0).max(8, "Decimal places must be between 0 and 8."),
  conversionProviderId: z.string().min(1, "Choose the provider that converts it.").max(26),
  priceSource: z.enum(["fiat_feed", "coinbase", "usd_peg"]),
});

export async function createCurrency(input: unknown): Promise<ActionResult> {
  try {
    await authorize("currencies.manage");
    const p = NewCurrency.safeParse(input);
    if (!p.success) return invalid(p.error);
    await writes.createCurrency(p.data);
    return done(`${p.data.code} added, switched off. Switch it on from its card when you are ready.`);
  } catch (e) {
    return toActionResult(e);
  }
}

const CurrencyChange = z.object({ code: z.string().min(2).max(10), enabled: z.boolean(), version: z.number().int().min(1) });

export async function updateCurrency(input: unknown): Promise<ActionResult> {
  try {
    await authorize("currencies.manage");
    const p = CurrencyChange.safeParse(input);
    if (!p.success) return invalid(p.error);
    await writes.updateCurrency(p.data.code, { enabled: p.data.enabled }, p.data.version);
    return done(p.data.enabled ? "Switched on. It now shows in the app." : "Switched off. It no longer shows in the app.");
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Service switches ─────────────────────────────────────────────────────────
const ServiceChange = z.object({
  code: z.string().min(1).max(40),
  enabled: z.boolean().optional(),
  disabledMessage: z.string().trim().max(200, "Keep the message to 200 characters or fewer.").optional(),
  version: z.number().int().min(0),
});

export async function updateService(input: unknown): Promise<ActionResult> {
  try {
    await authorize("services.manage");
    const p = ServiceChange.safeParse(input);
    if (!p.success) return invalid(p.error);
    await writes.updateService(p.data.code, { enabled: p.data.enabled, disabledMessage: p.data.disabledMessage }, p.data.version);
    return done(p.data.enabled === undefined ? "Message saved." : p.data.enabled ? "Switched on. Customers can use it again." : "Switched off. Customers can no longer use it.");
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Providers ────────────────────────────────────────────────────────────────
const ProviderChange = z.object({ id: z.string().min(1).max(40), usesNgnRail: z.boolean().optional(), enabled: z.boolean().optional(), version: z.number().int().min(0) });

export async function updateProvider(input: unknown): Promise<ActionResult> {
  try {
    await authorize("providers.manage");
    const p = ProviderChange.safeParse(input);
    if (!p.success) return invalid(p.error);
    await writes.updateProvider(p.data.id, { usesNgnRail: p.data.usesNgnRail, enabled: p.data.enabled }, p.data.version);
    return done(p.data.usesNgnRail !== undefined ? `NGN rail ${p.data.usesNgnRail ? "on" : "off"}.` : `Provider ${p.data.enabled ? "enabled" : "disabled"}.`);
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Card designs ─────────────────────────────────────────────────────────────
// The key is the one field the app reads (a theme's finish, a swatch's colour, a
// pattern's id), so it must be one the app can paint. Ids are derived from it.
const DesignBase = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(64, "Keep the name under 64 characters."),
  enabled: z.boolean(),
  sortOrder: z.number("Order is a whole number.").int("Order is a whole number.").min(0, "Order is 0 or more.").max(10_000, "Order is at most 10000."),
});
const Design = z.discriminatedUnion("kind", [
  DesignBase.extend({ kind: z.literal("theme"), key: z.enum(THEME_KEYS, "Pick a theme the app can paint.") }),
  DesignBase.extend({ kind: z.literal("swatch"), key: z.string().trim().regex(/^#?[0-9A-Fa-f]{6}$/, "Colours are 6 hex digits, e.g. FF7A5C.").transform((v) => v.replace("#", "").toUpperCase()) }),
  DesignBase.extend({ kind: z.literal("pattern"), key: z.enum(PATTERN_KEYS, "Pick a pattern the app can draw.") }),
]);
const DesignRef = z.object({ id: z.string().trim().min(2).max(48).regex(/^[a-zA-Z0-9-]+$/, "Invalid design."), version: z.number().int().min(1, "Reload the page and try again.") });

// API field names → the editor's (the kind's own field is the editor's "key")
const DESIGN_FIELDS: Record<string, string> = { finish: "key", hex_color: "key", pattern: "key", sort_order: "sortOrder", name: "name", enabled: "enabled", id: "key", kind: "kind" };

function designFailed(e: unknown): ActionResult {
  const r = toActionResult(e);
  if (r.fieldErrors) r.fieldErrors = Object.fromEntries(Object.entries(r.fieldErrors).map(([k, v]) => [DESIGN_FIELDS[k] ?? k, v]));
  if (e instanceof ApiError && e.status === 409) {
    if (e.code === "DESIGN_EXISTS") return { ...r, message: "That design already exists. Edit it, or turn it back on, from its row." };
    // someone saved first: show the latest so the next try carries the new version
    refresh();
    return { ...r, message: "Someone changed this design while you had it open. Reopen it to see the latest, then try again." };
  }
  return r;
}

/** Create or update a design. `ref` (id + version) is required to update. */
export async function saveCardDesign(input: unknown, ref?: { id: string; version: number }): Promise<ActionResult> {
  try {
    await authorize("card_designs.manage");
    const p = Design.safeParse(input);
    if (!p.success) return { ...invalid(p.error), fieldErrors: z.flattenError(p.error).fieldErrors as Record<string, string[]> };
    const r = ref ? DesignRef.safeParse(ref) : null;
    if (r && !r.success) return invalid(r.error);
    const { kind, key, name, enabled, sortOrder } = p.data;
    const d: writes.DesignInput = {
      // never trust a client id when creating: it's `${kind}-${key}`, as the seeder makes them
      id: r ? r.data.id : designId(kind, key),
      kind,
      name,
      finish: kind === "theme" ? key : "",
      hexColor: kind === "swatch" ? key : null,
      pattern: kind === "pattern" ? key : null,
      enabled,
      sortOrder,
    };
    await (r ? writes.updateCardDesign(d, r.data.version) : writes.createCardDesign(d));
    return done(r ? `${name} saved.` : `${name} added${enabled ? "; the app offers it now" : " (off)"}.`);
  } catch (e) {
    return designFailed(e);
  }
}

export async function disableCardDesign(id: string, version: number): Promise<ActionResult> {
  try {
    await authorize("card_designs.manage");
    const p = DesignRef.safeParse({ id, version });
    if (!p.success) return invalid(p.error);
    await writes.disableCardDesign(p.data.id, p.data.version);
    return done("Turned off. Customers can't pick it any more; cards already using it keep their look.");
  } catch (e) {
    return designFailed(e);
  }
}

export async function enableCardDesign(id: string, version: number): Promise<ActionResult> {
  try {
    await authorize("card_designs.manage");
    const p = DesignRef.safeParse({ id, version });
    if (!p.success) return invalid(p.error);
    await writes.enableCardDesign(p.data.id, p.data.version);
    return done("Turned on. Customers can pick it in the app again.");
  } catch (e) {
    return designFailed(e);
  }
}

// ── Ledger & jobs ────────────────────────────────────────────────────────────
export async function verifyLedger(): Promise<ActionResult & { problems?: string[] }> {
  try {
    await authorize("ledger.view");
    const r = await get<{ ok: boolean; problems: unknown[] | null }>("/ledger/verify");
    const problems = (r.problems ?? []).map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
    return { ok: r.ok, message: r.ok ? "Ledger balances: every entry nets to zero and balances match the snapshots." : `${problems.length} problem${problems.length === 1 ? "" : "s"} found.`, problems, at: Date.now() };
  } catch (e) {
    return toActionResult(e);
  }
}

export async function retryJob(queue: string, id: string): Promise<ActionResult> {
  try {
    await authorize("jobs.manage");
    if (!/^[a-z_-]{1,30}$/.test(queue) || typeof id !== "string" || !id || id.length > 80) return { ok: false, message: "Invalid job.", at: Date.now() };
    await writes.retryJob(queue, id);
    return done("Job queued again.");
  } catch (e) {
    return toActionResult(e);
  }
}

export async function runDailySnapshot(): Promise<ActionResult> {
  try {
    await authorize("jobs.manage");
    const r = await writes.runDailySnapshot();
    return done(r.message || "Daily snapshot ran.");
  } catch (e) {
    return toActionResult(e);
  }
}

// ── Live support (SSE events carry only a type and thread id) ────────────────
/** Unread total for the sidebar badge, plus who/what changed for the toast. */
export async function supportPulse(threadId?: string) {
  const me = await authorize();
  if (!me.perms.includes("support.view")) return { unread: 0, thread: null };
  const { rows } = await listThreads({});
  const t = threadId ? rows.find((r) => r.id === threadId) : undefined;
  return { unread: rows.reduce((s, r) => s + r.unread, 0), thread: t ? { customerName: t.customerName, subject: t.subject, preview: t.preview } : null };
}

/**
 * Batch form of supportPulse for the live listener: one thread-list read answers for every thread
 * in a burst of events (a reply, a status change and a new message arriving together cost one
 * read, not three). Unknown ids are simply left out.
 */
export async function supportPulseMany(threadIds: string[]) {
  const me = await authorize();
  if (!me.perms.includes("support.view")) return { unread: 0, threads: {} as Record<string, { customerName: string; subject: string; preview: string }> };
  const { rows } = await listThreads({});
  const wanted = new Set(threadIds.slice(0, 20));
  const threads: Record<string, { customerName: string; subject: string; preview: string }> = {};
  for (const r of rows) if (wanted.has(r.id)) threads[r.id] = { customerName: r.customerName, subject: r.subject, preview: r.preview };
  return { unread: rows.reduce((sum, r) => sum + r.unread, 0), threads };
}

// ── Live rates (polled by /rates every ~10 s) ────────────────────────────────
export async function pollRates() {
  await authorize("currencies.view");
  return listRates();
}

export async function getRateHistory(asset: string, hours: number) {
  await authorize("currencies.view");
  if (typeof asset !== "string" || !/^[A-Z]{2,10}$/.test(asset)) return [];
  return rateHistory(asset, Math.min(Math.max(Math.round(hours) || 24, 1), 168));
}
