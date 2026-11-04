"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Picker } from "@/components/ui/Picker";
import { decideVerification, type ActionResult } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

const REASONS = ["Name doesn't match", "Number not found", "Selfie unclear", "Document unreadable", "Other"] as const;

/**
 * Approve or reject one verification REQUEST (all its checks at once). Rejecting asks for a
 * reason (a preset, or your own words for "Other", plus an optional note). The customer sees it,
 * so the modal says so. On an error the modal stays open with what you typed.
 */
export function KycDecision({ id, title }: { id: string; title: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [preset, setPreset] = useState<string>(REASONS[0]);
  const [note, setNote] = useState("");
  const other = preset === "Other";
  const reason = (other ? note.trim() : note.trim() ? `${preset}. ${note.trim()}` : preset).slice(0, 255);
  const valid = reason.length >= 3;

  const [, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const res = await decideVerification(prev, fd);
    (res.ok ? toast.success : toast.error)(res.message);
    if (res.ok) {
      setRejecting(false);
      setNote("");
      setPreset(REASONS[0]);
    }
    return res;
  }, null);

  return (
    <>
      <form action={action} className="flex flex-nowrap items-center justify-end gap-2">
        <input type="hidden" name="id" value={id} />
        <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={pending}>Reject</Button>
        <Button size="sm" variant="primary" type="submit" name="decision" value="approve" disabled={pending}>{pending && !rejecting ? "Approving…" : "Approve"}</Button>
      </form>

      <Modal open={rejecting} onClose={() => !pending && setRejecting(false)} title="Reject request" subtitle={`${title}. The customer can send a new request after this.`}>
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <input type="hidden" name="reason" value={reason} />
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium">Reason</span>
            <Picker label="Reason" size="md" value={preset} onChange={(v) => setPreset(v || preset)} options={REASONS.map((r) => ({ value: r, label: r }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium">{other ? "Say what's wrong" : "Note (optional)"}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={other}
              minLength={other ? 3 : undefined}
              maxLength={200}
              rows={3}
              className="w-full rounded-chip border border-line bg-surface p-3 outline-none focus:border-purple-300 focus-visible:outline-none"
              placeholder={other ? "e.g. The NIN belongs to someone else" : "e.g. Use the name on your NIN slip"}
            />
          </label>
          <p className="rounded-chip bg-sunken p-3 text-[12.5px]">
            <span className="font-semibold">The customer sees this reason:</span> <span className="text-muted">{valid ? reason : "…"}</span>
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={pending || !valid}>{pending ? "Rejecting…" : "Reject request"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
