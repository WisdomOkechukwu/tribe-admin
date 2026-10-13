import "server-only";
import type { AdminProfile } from "@/lib/domain/admins";
import { TOPUP_POOLS, round } from "@/lib/domain/catalog";
import type { AuditAction, CustomerStatus, MarkupRule, SupportThread, ThreadStatus, TxType } from "@/lib/domain/types";
import { publish } from "@/lib/support/bus";
import { db, nextId } from "./db";
import { CHAT_TOPICS } from "./seed";

// Write side of the backend seam. Server actions authorise + validate, then
// call these. Swap each body for a POST to the real API.

export function logAudit(admin: AdminProfile, action: AuditAction, target: string, summary: string, before?: string, after?: string) {
  audit(admin, action, target, summary, before, after);
}

function audit(admin: AdminProfile, action: AuditAction, target: string, summary: string, before?: string, after?: string) {
  db().audit.unshift({ id: nextId("aud"), adminId: admin.id, adminName: admin.name, action, target, summary, before, after, at: new Date().toISOString() });
}

export function recordAuth(admin: AdminProfile, action: "login" | "logout") {
  audit(admin, action, admin.email, action === "login" ? "Signed in" : "Signed out");
}

/** Adds naira to an NGN book. Every book can be topped up except Cashpoint NGN (escrow). */
export function topUpPool(admin: AdminProfile, input: { poolId: string; amountNgn: number; externalRef: string; note?: string }) {
  const d = db();
  const pool = d.poolById.get(input.poolId);
  if (!pool) throw new Error("Unknown inventory book.");
  if (!TOPUP_POOLS.includes(pool.id) || !pool.topup) throw new Error(`${pool.label} can't be topped up. It's managed by the system.`);
  const amount = round("NGN", input.amountNgn);
  const at = new Date().toISOString();
  const before = pool.balance;
  pool.balance = round("NGN", before + amount);
  pool.updatedAt = at;
  d.entries.unshift({ id: nextId("inv"), poolId: pool.id, kind: "topup", delta: amount, before, after: pool.balance, externalRef: input.externalRef, note: input.note, adminId: admin.id, at, fundedNgn: amount });
  audit(admin, "inventory.topup", pool.id, `${pool.label} topped up +₦${amount.toLocaleString("en-NG")}${input.note ? ` · ${input.note}` : ""}`, String(before), String(pool.balance));
  return { pool, amount };
}

export type MarkupPatch = Pick<MarkupRule, "txType" | "ratePct" | "feePct" | "flatFee" | "active">;

export function saveMarkupRules(admin: AdminProfile, patches: MarkupPatch[]) {
  const d = db();
  const at = new Date().toISOString();
  const changed: TxType[] = [];
  for (const p of patches) {
    const rule = d.markups.find((m) => m.txType === p.txType);
    if (!rule) continue;
    const diffs: string[] = [];
    if (rule.ratePct !== p.ratePct) diffs.push(`rate ${rule.ratePct}% → ${p.ratePct}%`);
    if (rule.feePct !== p.feePct) diffs.push(`fee ${rule.feePct}% → ${p.feePct}%`);
    if (rule.flatFee !== p.flatFee) diffs.push(`flat ${rule.flatFee} → ${p.flatFee} ${rule.flatFeeAsset}`);
    if (rule.active !== p.active) diffs.push(p.active ? "activated" : "deactivated");
    if (!diffs.length) continue;
    const before = JSON.stringify({ ratePct: rule.ratePct, feePct: rule.feePct, flatFee: rule.flatFee, active: rule.active });
    Object.assign(rule, { ratePct: p.ratePct, feePct: p.feePct, flatFee: p.flatFee, active: p.active, updatedAt: at, updatedBy: admin.id });
    const after = JSON.stringify({ ratePct: rule.ratePct, feePct: rule.feePct, flatFee: rule.flatFee, active: rule.active });
    audit(admin, "markup.update", p.txType, diffs.join(", "), before, after);
    changed.push(p.txType);
  }
  return changed;
}

export function decideVerification(admin: AdminProfile, id: string, decision: "approve" | "reject", reason?: string) {
  const d = db();
  const v = d.verifications.find((x) => x.id === id);
  if (!v) throw new Error("Verification not found.");
  if (v.status !== "pending") throw new Error("This check was already decided.");
  const c = d.customerById.get(v.customerId)!;
  v.status = decision === "approve" ? "approved" : "failed";
  v.decidedAt = new Date().toISOString();
  v.decidedBy = admin.name;
  v.reason = decision === "reject" ? reason || "Rejected on manual review" : undefined;
  const tierChecks = d.verifications.filter((x) => x.customerId === c.id && x.tier === v.tier);
  const before = `tier ${c.kycTier} · ${c.kycStatus}`;
  if (decision === "reject") c.kycStatus = "failed";
  else if (tierChecks.every((x) => x.status === "approved")) {
    c.kycTier = Math.max(c.kycTier, v.tier) as typeof c.kycTier;
    c.kycStatus = "approved";
  }
  audit(admin, decision === "approve" ? "kyc.approve" : "kyc.reject", c.id, `${v.check.toUpperCase()} (tier ${v.tier}) for @${c.tag}${v.reason ? `: ${v.reason}` : ""}`, before, `tier ${c.kycTier} · ${c.kycStatus}`);
  return { customerId: c.id };
}

export function setCustomerStatus(admin: AdminProfile, id: string, status: Extract<CustomerStatus, "active" | "frozen">, reason: string) {
  const c = db().customerById.get(id);
  if (!c) throw new Error("Customer not found.");
  if (c.status === "closed") throw new Error("Closed accounts can't be changed.");
  const before = c.status;
  c.status = status;
  audit(admin, status === "frozen" ? "customer.freeze" : "customer.unfreeze", id, `@${c.tag}: ${reason}`, before, status);
}

export function setCustomerLabels(admin: AdminProfile, id: string, labels: string[]) {
  const c = db().customerById.get(id);
  if (!c) throw new Error("Customer not found.");
  const before = c.labels.join(", ") || "—";
  c.labels = labels;
  audit(admin, "customer.labels", id, `@${c.tag} labels updated`, before, labels.join(", ") || "—");
}

// ── Support ──────────────────────────────────────────────────────────────────
export const unreadTotal = () => db().threads.reduce((s, t) => s + t.unread, 0);

function touch(t: SupportThread) {
  const d = db();
  d.activity += 1;
  t.activity = d.activity;
  t.updatedAt = new Date().toISOString();
  d.threads.sort((a, b) => b.activity - a.activity);
}

function nameOf(customerId: string) {
  const c = db().customerById.get(customerId);
  return c ? `${c.firstName} ${c.lastName}` : "Customer";
}

export function replyToThread(admin: AdminProfile, threadId: string, body: string) {
  const t = db().threads.find((x) => x.id === threadId);
  if (!t) throw new Error("Conversation not found.");
  t.messages.push({ id: nextId("msg"), from: "agent", author: admin.name, body, at: new Date().toISOString() });
  t.unread = 0;
  if (t.status === "open") t.status = "pending";
  touch(t);
  audit(admin, "support.reply", t.id, `Replied to ${nameOf(t.customerId)}: ${body.slice(0, 80)}`);
  publish({ type: "thread.updated", threadId: t.id, customerName: nameOf(t.customerId), subject: t.subject, preview: body, unread: unreadTotal() });
}

export function setThreadStatus(admin: AdminProfile, threadId: string, status: ThreadStatus) {
  const t = db().threads.find((x) => x.id === threadId);
  if (!t) throw new Error("Conversation not found.");
  const before = t.status;
  t.status = status;
  if (status === "resolved") t.unread = 0;
  t.messages.push({ id: nextId("msg"), from: "system", author: "Tribe", body: `${admin.name} marked this ${status}.`, at: new Date().toISOString() });
  touch(t);
  const c = db().customerById.get(t.customerId);
  const ticket = c?.tickets.find((k) => k.id === t.id);
  if (ticket) ticket.status = status === "resolved" ? "resolved" : "open";
  audit(admin, "support.status", t.id, `${t.subject}: ${before} → ${status}`, before, status);
  publish({ type: "thread.updated", threadId: t.id, customerName: nameOf(t.customerId), subject: t.subject, preview: `Marked ${status}`, unread: unreadTotal() });
}

export function markThreadRead(threadId: string) {
  const t = db().threads.find((x) => x.id === threadId);
  if (!t || t.unread === 0) return false;
  t.unread = 0;
  publish({ type: "thread.updated", threadId: t.id, customerName: nameOf(t.customerId), subject: t.subject, preview: "", unread: unreadTotal() });
  return true;
}

const FOLLOW_UPS = ["any update? 👀", "still waiting on this pls", "ok I just sent the screenshot", "it worked now 🙌 thank you", "hello??", "how long will this take?"];
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** Demo: a customer opens a new ticket from the app (or a new in-app chat). */
export function simulateNewTicket() {
  const d = db();
  const now = new Date().toISOString();
  const failed = d.transactions.find((t) => t.status === "failed" && !d.threads.some((x) => x.txId === t.id) && Math.random() < 0.2) ?? d.transactions.find((t) => t.status === "failed" && !d.threads.some((x) => x.txId === t.id));
  const c = failed ? d.customerById.get(failed.customerId)! : pick(d.customers);
  let t: SupportThread;
  if (failed && Math.random() < 0.7) {
    const reason = failed.category === "utility" ? "Token not received" : failed.category === "giftcard" ? "Gift card rejected" : failed.category === "virtual_card" ? "Card declined" : "Money left my wallet but didn't arrive";
    const id = `SUP-${String(Math.floor(100000 + Math.random() * 899999))}`;
    t = {
      id, customerId: c.id, channel: "ticket", subject: reason, txId: failed.id, status: "open",
      priority: failed.usdValue > 300 ? "urgent" : failed.usdValue > 50 ? "high" : "normal",
      createdAt: now, updatedAt: now, activity: 0, unread: 1,
      messages: [
        { id: nextId("msg"), from: "system", author: "Tribe", body: `Ticket ${id} opened from the app for ${failed.reference}.`, at: now },
        { id: nextId("msg"), from: "customer", author: c.firstName, body: `Hi, ${failed.title} failed (${failed.reference}): ${failed.failureReason ?? "it didn't go through"}. Please help 🙏`, at: now },
      ],
    };
    c.tickets.push({ id, txId: failed.id, reason, status: "open", createdAt: now });
  } else {
    const topic = pick(CHAT_TOPICS);
    t = {
      id: `CHT-${String(Math.floor(100000 + Math.random() * 899999))}`, customerId: c.id, channel: "chat", subject: topic.subject,
      status: "open", priority: "normal", createdAt: now, updatedAt: now, activity: 0, unread: 1,
      messages: [{ id: nextId("msg"), from: "customer", author: c.firstName, body: topic.q, at: now }],
    };
  }
  d.threads.unshift(t);
  touch(t);
  publish({ type: "ticket.new", threadId: t.id, customerName: `${c.firstName} ${c.lastName}`, subject: t.subject, preview: t.messages[t.messages.length - 1].body, unread: unreadTotal() });
  return t.id;
}

/** Demo: a customer responds in an existing in-app chat/ticket. */
export function simulateCustomerReply() {
  const d = db();
  const candidates = d.threads.filter((t) => t.status !== "resolved").slice(0, 25);
  if (!candidates.length) return simulateNewTicket();
  const t = pick(candidates);
  const c = d.customerById.get(t.customerId)!;
  const body = pick(FOLLOW_UPS);
  t.messages.push({ id: nextId("msg"), from: "customer", author: c.firstName, body, at: new Date().toISOString() });
  t.unread += 1;
  t.status = "open";
  touch(t);
  publish({ type: "chat.message", threadId: t.id, customerName: `${c.firstName} ${c.lastName}`, subject: t.subject, preview: body, unread: unreadTotal() });
  return t.id;
}
