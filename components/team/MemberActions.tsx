"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { removeTeammate, resetTeammatePassword, setTeammateStatus } from "@/lib/actions/team";
import { toast } from "@/stores/toast-store";
import { PasswordReveal } from "./TeamEditor";

type Confirm = { kind: "suspend" | "remove" | "reset" } | null;

export function MemberActions({ id, name, email, status, isMe }: { id: string; name: string; email: string; status: "active" | "suspended"; isMe: boolean }) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string; password?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.message);
      toast.success(r.message);
      if (r.password) setPassword(r.password);
      setConfirm(null);
    });

  if (isMe) return <span className="text-[11.5px] font-semibold text-muted">That&apos;s you 👋</span>;

  const copy = {
    suspend: { title: `Suspend ${name}?`, body: "They're signed out on their next click and can't sign back in until reactivated. Nothing is deleted.", cta: "Suspend", variant: "danger" as const },
    remove: { title: `Remove ${name}?`, body: "Their account is deleted. Their past actions stay in the audit log. This can't be undone.", cta: "Remove for good", variant: "danger" as const },
    reset: { title: `Reset ${name}'s password?`, body: "Their current password stops working right away. You'll get a new temporary one to share.", cta: "Reset password", variant: "primary" as const },
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {status === "active" ? (
          <Button size="sm" onClick={() => setConfirm({ kind: "suspend" })} disabled={pending}>Suspend</Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => run(() => setTeammateStatus(id, "active"))} disabled={pending}>Reactivate</Button>
        )}
        <Button size="sm" onClick={() => setConfirm({ kind: "reset" })} disabled={pending} aria-label={`Reset password for ${name}`}><Icon name="key" size={13} /></Button>
        <Button size="sm" onClick={() => setConfirm({ kind: "remove" })} disabled={pending} aria-label={`Remove ${name}`}><Icon name="trash" size={13} /></Button>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm ? copy[confirm.kind].title : ""}>
        {confirm && (
          <div className="space-y-5 p-6">
            <p className="text-[13.5px]">{copy[confirm.kind].body}</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant={copy[confirm.kind].variant}
                disabled={pending}
                onClick={() => run(() => (confirm.kind === "suspend" ? setTeammateStatus(id, "suspended") : confirm.kind === "remove" ? removeTeammate(id) : resetTeammatePassword(id)))}
              >
                {pending ? "Working…" : copy[confirm.kind].cta}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!password} onClose={() => setPassword(null)} title="New password" footer={<><span /><Button variant="primary" onClick={() => setPassword(null)}>Done</Button></>}>
        <PasswordReveal name={name} password={password ?? undefined} email={email} />
      </Modal>
    </>
  );
}
