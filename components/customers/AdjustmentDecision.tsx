"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { decideAdjustment } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

/**
 * Step 2 of a manual credit or debit: a SUPER ADMIN who didn't request it
 * approves (posts it to the wallet) or rejects (with a reason). Everyone
 * else sees who it's waiting for.
 */
export function AdjustmentDecision({ id, own, superAdmin }: { id: string; own: boolean; superAdmin: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  if (!superAdmin) return <span className="text-[12px] text-muted" title="Only a super admin can approve manual credits and debits">Waiting for a super admin</span>;
  if (own) return <span className="text-[12px] text-muted" title="Four-eyes rule: someone else must decide">Waiting for another super admin</span>;

  const run = (decision: "approve" | "reject") =>
    start(async () => {
      const r = await decideAdjustment(id, decision, decision === "reject" ? reason : undefined);
      (r.ok ? toast.success : toast.error)(r.message);
      if (r.ok) setRejecting(false);
    });

  return rejecting ? (
    <form className="flex flex-nowrap items-center justify-end gap-2" onSubmit={(e) => { e.preventDefault(); run("reject"); }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={200} autoFocus placeholder="Reason" aria-label="Reason for rejecting" className="h-8 w-40 min-w-0 rounded-full border-2 border-edge bg-surface px-3 text-[12.5px] outline-none focus:border-purple-500 focus-visible:outline-none" />
      <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={pending}>Cancel</Button>
      <Button size="sm" variant="danger" type="submit" disabled={pending || reason.trim().length < 3}>{pending ? "Rejecting…" : "Reject"}</Button>
    </form>
  ) : (
    <div className="flex flex-nowrap items-center justify-end gap-2">
      <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={pending}>Reject</Button>
      <Button size="sm" variant="primary" onClick={() => run("approve")} disabled={pending}>{pending ? "Posting…" : "Approve & post"}</Button>
    </div>
  );
}
