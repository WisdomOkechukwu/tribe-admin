"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { setCustomerLabels, setCustomerStatus, type ActionResult } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

export function FreezeButton({ id, status, name }: { id: string; status: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const res = await setCustomerStatus(prev, fd);
    if (res.ok) { toast.success(res.message); setOpen(false); }
    else toast.error(res.message);
    return res;
  }, null);
  const freezing = status !== "frozen";

  if (status === "closed") return null;
  return (
    <>
      <Button variant={freezing ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>
        {freezing ? "Freeze account" : "Unfreeze account"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={freezing ? "Freeze account" : "Unfreeze account"} subtitle={freezing ? `${name} won't be able to move money until unfrozen. Incoming payments still land.` : `${name} regains full access.`}>
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={freezing ? "frozen" : "active"} />
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium">Reason (goes to the audit log)</span>
            <textarea name="reason" required minLength={3} maxLength={200} rows={3} className="w-full rounded-chip border border-line bg-surface p-3 outline-none focus:border-purple-300 focus-visible:outline-none" placeholder={freezing ? "e.g. Suspected account takeover, ticket SUP-…" : "e.g. Identity re-verified"} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant={freezing ? "danger" : "primary"} disabled={pending}>{pending ? "Saving…" : freezing ? "Freeze" : "Unfreeze"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function LabelEditor({ id, labels, options, canEdit }: { id: string; labels: string[]; options: string[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(labels);
  const [custom, setCustom] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await setCustomerLabels(id, sel);
      if (res.ok) { toast.success(res.message); setOpen(false); }
      else toast.error(res.message);
    });

  const all = [...new Set([...options, ...sel])];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((l) => <Badge key={l} tone={["high-risk", "watchlist", "chargeback-risk"].includes(l) ? "orange" : "purple"}>{l}</Badge>)}
      {canEdit && (
        <button type="button" onClick={() => { setSel(labels); setOpen(true); }} className="pop cursor-pointer rounded-full bg-surface px-2.5 py-0.5 text-[11.5px] font-bold">
          {labels.length ? "Edit labels" : "+ Add label"}
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Labels" subtitle="Labels are internal. Customers never see them. Up to 6.">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-1.5">
            {all.map((l) => {
              const on = sel.includes(l);
              return (
                <button key={l} type="button" aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== l) : [...sel, l])} className={`pop cursor-pointer rounded-full px-3 py-1 text-[12.5px] font-semibold ${on ? "bg-purple-500 text-white" : "bg-surface"}`}>
                  {l}
                </button>
              );
            })}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); const v = custom.trim().toLowerCase(); if (v && !sel.includes(v)) setSel([...sel, v]); setCustom(""); }}
          >
            <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={24} placeholder="Custom label" aria-label="Custom label" className="h-9 flex-1 rounded-chip border border-line bg-surface px-3 outline-none focus:border-purple-300 focus-visible:outline-none" />
            <Button type="submit" size="md">Add</Button>
          </form>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save labels"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
