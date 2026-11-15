"use client";

import { useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { updateCurrency } from "@/lib/actions/admin";
import { toast } from "@/stores/toast-store";

/** A currency's on/off switch. One PUT with the row's version per flip. */
export function CurrencySwitch({ code, name, enabled, version, canManage }: { code: string; name: string; enabled: boolean; version: number; canManage: boolean }) {
  const [pending, start] = useTransition();
  const flip = (on: boolean) =>
    start(async () => {
      const r = await updateCurrency({ code, enabled: on, version });
      (r.ok ? toast.success : toast.error)(r.ok ? `${name}: ${r.message}` : r.message);
    });
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold" aria-busy={pending}>
      <Toggle on={enabled} onChange={flip} label={`${name}: available in the app`} disabled={!canManage || pending} />
      {pending ? "Saving…" : enabled ? "On in the app" : "Off in the app"}
    </label>
  );
}
