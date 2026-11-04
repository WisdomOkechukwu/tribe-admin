"use client";

import { useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { updateProvider } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

/** NGN rail + enabled switches. Each flip is one PUT with the row's version. */
export function ProviderToggles({ id, name, usesNgnRail, enabled, version, canManage }: { id: string; name: string; usesNgnRail: boolean; enabled: boolean; version: number; canManage: boolean }) {
  const [pending, start] = useTransition();
  const flip = (change: { usesNgnRail?: boolean; enabled?: boolean }) =>
    start(async () => {
      const r = await updateProvider({ id, version, ...change });
      (r.ok ? toast.success : toast.error)(r.ok ? `${name}: ${r.message}` : r.message);
    });
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3" aria-busy={pending}>
      <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
        <Toggle on={usesNgnRail} onChange={(on) => flip({ usesNgnRail: on })} label={`${name}: route conversions through NGN`} disabled={!canManage || pending} />
        NGN rail
      </label>
      <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
        <Toggle on={enabled} onChange={(on) => flip({ enabled: on })} label={`${name}: enabled`} disabled={!canManage || pending} />
        {enabled ? "Enabled" : "Disabled"}
      </label>
      {pending && <span className="text-[12px] text-muted">Saving…</span>}
    </div>
  );
}
