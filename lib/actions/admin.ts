"use server";

import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/lib/auth/current";
import { TAGS, getTransaction, quickSearch } from "@/lib/data/repo";
import * as writes from "@/lib/data/writes";
import { CUSTOMER_LABELS, TX_TYPES } from "@/lib/domain/catalog";
import { fmtMoney } from "@/lib/format";

// Every action: authorise (role re-checked from the cookie) → validate (zod)
// → write → audit (inside writes) → updateTag so the admin reads their write.

export type ActionResult = { ok: boolean; message: string; at?: number };

const fail = (e: unknown): ActionResult => {
  unstable_rethrow(e); // let redirect("/login") from authorize() through
  return { ok: false, message: e instanceof Error ? e.message : "Something went wrong.", at: Date.now() };
};

// ── Inventory top-up ─────────────────────────────────────────────────────────
const TopUp = z.object({
  poolId: z.string().min(1, "Pick an NGN book to top up."),
  amount: z.coerce.number({ message: "Enter the NGN amount." }).min(1000, "Minimum top-up is ₦1,000.").max(1e12, "That amount is too large."),
  externalRef: z.string().trim().min(3, "Add the provider/bank reference.").max(64),
  note: z.string().trim().max(200).optional(),
});

export async function topUpInventory(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await authorize("inventory.topup");
    const input = TopUp.parse({
      poolId: formData.get("poolId"),
      amount: String(formData.get("amount") ?? "").replace(/,/g, ""),
      externalRef: formData.get("externalRef"),
      note: formData.get("note") || undefined,
    });
    const { pool, amount } = writes.topUpPool(admin, { poolId: input.poolId, amountNgn: input.amount, externalRef: input.externalRef, note: input.note });
    updateTag(TAGS.inventory);
    updateTag(TAGS.audit);
    return { ok: true, message: `${pool.label} updated ${fmtMoney("NGN", amount, { sign: true })}`, at: Date.now() };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "Check the form.", at: Date.now() };
    return fail(e);
  }
}

// ── Markups ──────────────────────────────────────────────────────────────────
const TYPES = TX_TYPES.map((t) => t.type) as [string, ...string[]];
const Markups = z
  .array(
    z.object({
      txType: z.enum(TYPES),
      ratePct: z.number().min(0).max(25),
      feePct: z.number().min(0).max(10),
      flatFee: z.number().min(0).max(100_000),
      active: z.boolean(),
    }),
  )
  .max(TX_TYPES.length);

export async function saveMarkups(rules: unknown): Promise<ActionResult> {
  try {
    const admin = await authorize("markups.edit");
    const parsed = Markups.safeParse(rules);
    if (!parsed.success) return { ok: false, message: "Rate markup must be 0–25%, fee markup 0–10%, flat fee 0–100,000.", at: Date.now() };
    const changed = writes.saveMarkupRules(admin, parsed.data as writes.MarkupPatch[]);
    if (changed.length) {
      updateTag(TAGS.markups);
      updateTag(TAGS.audit);
    }
    return { ok: true, message: changed.length ? `Saved ${changed.length} markup rule${changed.length > 1 ? "s" : ""}.` : "No changes to save.", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

// ── KYC decisions ────────────────────────────────────────────────────────────
const Decision = z.object({ id: z.string().min(1), decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(200).optional() });

export async function decideVerification(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await authorize("kyc.decide");
    const input = Decision.parse({ id: formData.get("id"), decision: formData.get("decision"), reason: formData.get("reason") || undefined });
    const { customerId } = writes.decideVerification(admin, input.id, input.decision, input.reason);
    updateTag(TAGS.kyc);
    updateTag(TAGS.customer(customerId));
    updateTag(TAGS.customers);
    updateTag(TAGS.audit);
    return { ok: true, message: input.decision === "approve" ? "Check approved." : "Check rejected.", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

// ── Customer status & labels ─────────────────────────────────────────────────
const Status = z.object({ id: z.string().min(1), status: z.enum(["active", "frozen"]), reason: z.string().trim().min(3, "Give a reason (min 3 characters).").max(200) });

export async function setCustomerStatus(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await authorize("customers.freeze");
    const parsed = Status.safeParse({ id: formData.get("id"), status: formData.get("status"), reason: formData.get("reason") });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form.", at: Date.now() };
    writes.setCustomerStatus(admin, parsed.data.id, parsed.data.status, parsed.data.reason);
    updateTag(TAGS.customer(parsed.data.id));
    updateTag(TAGS.customers);
    updateTag(TAGS.audit);
    return { ok: true, message: parsed.data.status === "frozen" ? "Account frozen." : "Account unfrozen.", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

const Labels = z.object({
  id: z.string().min(1),
  labels: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,24}$/, "Labels use 2–24 letters, numbers or dashes.")).max(6, "Up to 6 labels."),
});

export async function setCustomerLabels(id: string, labels: string[]): Promise<ActionResult> {
  try {
    const admin = await authorize("customers.labels");
    const known = new Map(CUSTOMER_LABELS.map((l) => [l.toLowerCase(), l]));
    const parsed = Labels.safeParse({ id, labels });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid labels.", at: Date.now() };
    const clean = [...new Set(parsed.data.labels.map((l) => known.get(l) ?? l))];
    writes.setCustomerLabels(admin, id, clean);
    updateTag(TAGS.customer(id));
    updateTag(TAGS.customers);
    updateTag(TAGS.audit);
    return { ok: true, message: "Labels updated.", at: Date.now() };
  } catch (e) {
    return fail(e);
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
  if (typeof id !== "string" || id.length > 40) return null;
  await authorize("transactions.view");
  const d = await getTransaction(id);
  if (!d) return null;
  // The drawer doesn't need the API log or related list; keep the payload lean.
  const { tx, customer, pools, people, customerImpact, systemImpact } = d;
  return { tx, customer, pools, people, customerImpact, systemImpact };
}

// ── Support inbox ────────────────────────────────────────────────────────────
const Reply = z.object({ threadId: z.string().min(1).max(40), body: z.string().trim().min(1, "Type a message.").max(2000) });

export async function replySupport(threadId: string, body: string): Promise<ActionResult> {
  try {
    const admin = await authorize("support.reply");
    const p = Reply.safeParse({ threadId, body });
    if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Invalid message.", at: Date.now() };
    writes.replyToThread(admin, p.data.threadId, p.data.body);
    updateTag(TAGS.support);
    updateTag(TAGS.audit);
    return { ok: true, message: "Sent", at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

export async function setSupportStatus(threadId: string, status: "open" | "pending" | "resolved"): Promise<ActionResult> {
  try {
    const admin = await authorize("support.resolve");
    if (!["open", "pending", "resolved"].includes(status) || typeof threadId !== "string") return { ok: false, message: "Invalid status.", at: Date.now() };
    writes.setThreadStatus(admin, threadId, status);
    updateTag(TAGS.support);
    updateTag(TAGS.customers);
    updateTag(TAGS.audit);
    return { ok: true, message: status === "resolved" ? "Resolved ✅" : `Marked ${status}`, at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}

export async function markSupportRead(threadId: string) {
  await authorize("support.view");
  if (typeof threadId === "string" && writes.markThreadRead(threadId)) updateTag(TAGS.support);
}

/** Demo only: makes a customer open a ticket or reply in chat, which triggers the live sound + toast. */
export async function simulateSupport(kind: "ticket" | "reply"): Promise<ActionResult> {
  try {
    await authorize("support.simulate");
    const id = kind === "ticket" ? writes.simulateNewTicket() : writes.simulateCustomerReply();
    updateTag(TAGS.support);
    updateTag(TAGS.customers);
    return { ok: true, message: id, at: Date.now() };
  } catch (e) {
    return fail(e);
  }
}
