"use client";

import { useActionState, useRef, useState } from "react";
import { Icon } from "@/components/shell/icons";
import { buttonClass } from "@/components/ui/Button";
import { saveReferralShare, type ActionResult } from "@/lib/actions/admin";
import type { ReferralSettings } from "@/lib/domain/types";
import { fmtDateTime } from "@/lib/format";
import { toast } from "@/stores/toast-store";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * The referral share: which percent of what Tribe earns (fees + conversion margins) on an invited
 * customer's transaction goes to the person who invited them. Customers nobody invited share
 * nothing. The API locks the row and checks `version`, so two admins can't overwrite each other.
 */
export function ReferralShareForm({ settings, canEdit }: { settings: ReferralSettings; canEdit: boolean }) {
  const [raw, setRaw] = useState(settings.sharePercent);
  const key = useRef<string | null>(null);
  const valid = /^\d+(\.\d{1,6})?$/.test(raw) && Number(raw) <= 100;
  const changed = raw !== settings.sharePercent;

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    key.current ??= newKey();
    fd.set("idempotencyKey", key.current);
    const res = await saveReferralShare(prev, fd);
    if (res.ok) {
      toast.success(res.message);
      key.current = null;
    } else toast.error(res.message);
    return res;
  }, null);

  // An example on ₦10,000 of earnings, so the percentage reads as money.
  const example = valid ? ((10_000 * Number(raw)) / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 }) : null;

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="version" value={settings.version} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-2 block text-[11.5px] font-bold uppercase tracking-wider">Referral share</span>
          <span className="flex h-12 w-40 items-center gap-1 rounded-chip border-2 border-edge bg-surface px-3.5 focus-within:border-purple-500 focus-within:shadow-hard-sm">
            <input
              name="sharePercent"
              inputMode="decimal"
              value={raw}
              disabled={!canEdit || pending}
              onChange={(e) => setRaw(e.target.value.replace(/[^\d.]/g, "").slice(0, 10))}
              aria-label="Referral share in percent"
              aria-invalid={!valid}
              className="display num h-full min-w-0 flex-1 bg-transparent text-[22px] font-extrabold outline-none focus-visible:outline-none disabled:opacity-60"
            />
            <span className="display text-[18px] font-extrabold text-muted">%</span>
          </span>
        </label>
        <button type="submit" disabled={!canEdit || pending || !valid || !changed} className={buttonClass("primary", "md", "h-12")}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {!valid && <p className="text-[12px] text-error-600">A number from 0 to 100, up to 6 decimals.</p>}
      <p className="text-[12.5px] text-muted">
        Of what Tribe earns (fees and conversion margins) on a transaction by a customer someone invited, this share goes to the person who invited them,
        valued in Naira and paid from Tribe Funds into their referral balance.{example !== null && <> On ₦10,000 of earnings the inviter gets <b className="text-ink-900 dark:text-white">₦{example}</b>.</>}{" "}
        Customers nobody invited share nothing. Set 0 to pause rewards.
      </p>
      <p className="text-[11.5px] text-muted">Last changed by {settings.updatedBy || "—"} · {fmtDateTime(settings.updatedAt)}</p>
      {state && !state.ok && <p role="alert" className="text-[12.5px] font-medium text-error-600">{state.message}</p>}
      {!canEdit && <p className="flex items-center gap-1.5 text-[12px] text-muted"><Icon name="lock" size={13} /> Needs “Change fees & margins”.</p>}
    </form>
  );
}
