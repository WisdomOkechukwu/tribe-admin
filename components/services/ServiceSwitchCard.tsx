"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { updateService } from "@/lib/actions/admin";
import type { ServiceSwitch } from "@/lib/domain/types";
import { toast } from "@/stores/toast-store";

/**
 * One service: its on/off switch and the message the app shows while it is off.
 * A flip and a message save are each one PUT with the row's version, so two
 * admins changing the same service at once get a "someone changed it first".
 */
export function ServiceSwitchCard({ service, canManage }: { service: ServiceSwitch; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState(service.disabledMessage);
  const changed = message.trim() !== service.disabledMessage;
  const save = (change: { enabled?: boolean; disabledMessage?: string }) =>
    start(async () => {
      const r = await updateService({ code: service.code, version: service.version, ...change });
      (r.ok ? toast.success : toast.error)(r.ok ? `${service.name}: ${r.message}` : r.message);
    });
  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="display text-[20px] font-extrabold uppercase">{service.name}</h2>
            <Badge tone={service.enabled ? "success" : "error"}>{service.enabled ? "On" : "Off for customers"}</Badge>
          </div>
          <p className="mt-1 text-[12.5px] text-muted">{service.description}</p>
        </div>
        {/* the message typed below goes with the flip, so switching off and explaining why is one step */}
        <Toggle on={service.enabled} onChange={(on) => save({ enabled: on, disabledMessage: changed ? message.trim() : undefined })} label={`${service.name}: available to customers`} disabled={!canManage || pending} />
      </div>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (changed) save({ disabledMessage: message.trim() }); }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          disabled={!canManage || pending}
          placeholder="Message shown in the app while off (optional)"
          aria-label={`${service.name}: message shown in the app while it is off`}
          className="h-9 min-w-0 flex-1 rounded-full border-2 border-edge bg-surface px-3 text-[12.5px] outline-none focus:border-purple-500 focus-visible:outline-none disabled:opacity-60"
        />
        {canManage && <Button size="sm" variant="secondary" type="submit" disabled={pending || !changed}>{pending ? "Saving…" : "Save message"}</Button>}
      </form>
    </div>
  );
}
