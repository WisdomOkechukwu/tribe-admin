"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { decideVerification, type ActionResult } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

/** Approve / reject a pending QoreID check. Reject asks for a reason. */
export function KycDecision({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const res = await decideVerification(prev, fd);
    (res.ok ? toast.success : toast.error)(res.message);
    if (!res.ok) setRejecting(false);
    return res;
  }, null);

  return (
    <form action={action} className="flex flex-nowrap items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      {rejecting ? (
        <>
          <input name="reason" required maxLength={200} autoFocus placeholder="Reason for rejection" aria-label="Reason for rejection" className="h-8 w-44 min-w-0 rounded-full border-2 border-edge bg-surface px-3 text-[12.5px] outline-none focus:border-purple-500 focus-visible:outline-none" />
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
          <Button size="sm" variant="danger" type="submit" name="decision" value="reject" disabled={pending}>Reject</Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={pending}>Reject</Button>
          <Button size="sm" variant="primary" type="submit" name="decision" value="approve" disabled={pending}>{pending ? "Saving…" : "Approve"}</Button>
        </>
      )}
    </form>
  );
}
