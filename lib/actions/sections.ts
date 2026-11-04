"use server";

import { settle } from "@/lib/api/client";
import {
  getAccountLegs, getJournalEntry, getThread, listCustomerAdjustments, listInventoryEntries, listLedgerAccounts, listTreasuryFundings, listVerificationQueue,
} from "@/lib/data/repo";
import { ASSET_CODES } from "@/lib/domain/catalog";
import { oneOf, pageOf, str, type SP } from "@/lib/params";

// Loaders for client sections (lib/hooks/useSection.ts): each re-reads ONE
// section with the URL params it owns, nothing else. Pages call the same
// loader for the first render (unawaited, so it streams), so server and client
// share one code path. The repo checks permissions; params come from the
// browser, so they're parsed defensively and never trusted.

const STATUSES = ["pending", "approved", "rejected"] as const;
const parse = (p: unknown): SP => (p && typeof p === "object" ? (p as SP) : {});
const pageIn = (q: SP, k: string) => pageOf({ page: str(q, k) });

/** Treasury funding requests: ?funding= (status tab) and ?fpage=. */
export async function loadFundings(p: unknown) {
  return settle(async () => {
    const q = parse(p);
    const status = oneOf(q, "funding", ["all", ...STATUSES]) ?? "pending";
    return { status, ...(await listTreasuryFundings({ status: status === "all" ? undefined : status, page: pageIn(q, "fpage") })) };
  });
}

/** Manual credits & debits: ?adjustment= (status tab), ?kind= and ?apage=. */
export async function loadAdjustments(p: unknown) {
  return settle(async () => {
    const q = parse(p);
    const status = oneOf(q, "adjustment", ["all", ...STATUSES]) ?? "pending";
    const kind = oneOf(q, "kind", ["credit", "debit"]);
    return { status, kind, ...(await listCustomerAdjustments({ status: status === "all" ? undefined : status, kind, page: pageIn(q, "apage") })) };
  });
}

/** Vault movements: ?asset= and ?page=. `page` is null while the backend lacks the route. */
export async function loadEntries(p: unknown) {
  return settle(async () => {
    const q = parse(p);
    return { page: await listInventoryEntries({ asset: str(q, "asset", 10), page: pageIn(q, "page") }) };
  });
}

/** The verification queue: ?status= and ?page=. */
export async function loadVerifications(p: unknown) {
  return settle(async () => {
    const q = parse(p);
    const status = oneOf(q, "status", STATUSES) ?? "pending";
    return { status, ...(await listVerificationQueue({ status, page: pageIn(q, "page") })) };
  });
}

/** One support conversation: ?t=. null when none is picked (or it's gone). */
export async function loadThread(p: unknown) {
  return settle(async () => {
    const t = str(parse(p), "t", 40);
    return t ? getThread(t) : null;
  });
}

/** A journal entry on the ledger page: ?entry=. */
export async function loadJournalEntry(p: unknown) {
  return settle(async () => {
    const id = str(parse(p), "entry", 40);
    return id ? { id, entry: await getJournalEntry(id) } : null;
  });
}

/** Ledger accounts: ?owner= (company or a customer id) and ?asset=. */
export async function loadLedgerAccounts(p: unknown) {
  return settle(async () => {
    const q = parse(p);
    const owner = str(q, "owner", 40) ?? "company";
    return { owner, rows: await listLedgerAccounts({ owner, asset: oneOf(q, "asset", ASSET_CODES) }) };
  });
}

/** One ledger account's legs: ?account= and ?page=. null when no account is picked. */
export async function loadAccountLegs(p: unknown) {
  return settle(async () => {
    const q = parse(p);
    const id = Number(str(q, "account", 12));
    return Number.isInteger(id) && id > 0 ? { id, ...(await getAccountLegs(id, pageIn(q, "page"))) } : null;
  });
}
