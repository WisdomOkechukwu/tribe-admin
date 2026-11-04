"use client";

import { useActionState, useRef, useState } from "react";
import { Icon } from "@/components/shell/icons";
import { buttonClass } from "@/components/ui/Button";
import { AssetIcon } from "@/components/ui/Money";
import { Picker } from "@/components/ui/Picker";
import { requestFunding, type ActionResult } from "@/lib/actions/admin";
import { assetInfo } from "@/lib/domain/catalog";
import { fmtMoney } from "@/lib/format";
import { toast } from "@/stores/toast-store";

export type VaultOpt = { asset: string; balance: string };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Step 1 of a treasury funding: record money that arrived in a company
 * account. Nothing is posted until a DIFFERENT admin approves it.
 * One Idempotency-Key per submission: a double-click or retry can't record it twice.
 */
export function FundingForm({ vaults, canRequest }: { vaults: VaultOpt[]; canRequest: boolean }) {
  const [asset, setAsset] = useState(vaults.find((v) => v.asset === "NGN")?.asset ?? vaults[0]?.asset ?? "NGN");
  const [raw, setRaw] = useState("");
  // made on the first submit (never while rendering, so the server and browser HTML match) and
  // reused if that same submission is retried; a successful one starts a fresh key
  const key = useRef<string | null>(null);
  const vault = vaults.find((v) => v.asset === asset);
  const decimals = assetInfo(asset).decimals;
  const clean = raw.replace(/,/g, "");
  const valid = /^\d+(\.\d+)?$/.test(clean) && /[1-9]/.test(clean) && (clean.split(".")[1]?.length ?? 0) <= decimals;

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    key.current ??= newKey();
    fd.set("idempotencyKey", key.current);
    const res = await requestFunding(prev, fd);
    if (res.ok) {
      toast.success(res.message);
      setRaw("");
      key.current = null;
    } else toast.error(res.message);
    return res;
  }, null);

  const input = "h-11 w-full rounded-chip border-2 border-edge bg-surface px-3.5 text-[13.5px] outline-none focus:border-purple-500 focus:shadow-hard-sm focus-visible:outline-none disabled:opacity-60";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="asset" value={asset} />
      <input type="hidden" name="amount" value={clean} />

      <fieldset disabled={!canRequest || pending} className="space-y-5 disabled:opacity-60">
        <div>
          <Label n={1}>Which vault?</Label>
          <Picker label="Asset" value={asset} onChange={(v) => setAsset(v || asset)} options={vaults.map((v) => ({ value: v.asset, label: `${v.asset} · ${fmtMoney(v.asset, v.balance)}` }))} />
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted"><AssetIcon asset={asset} size={14} /> {assetInfo(asset).name} · up to {decimals} decimals</p>
        </div>

        <div>
          <Label n={2}>Amount received</Label>
          <label className="flex h-14 items-center gap-2 rounded-chip border-2 border-edge bg-surface px-4 focus-within:border-purple-500 focus-within:shadow-hard-sm">
            <span className="display text-[20px] font-extrabold text-muted">{assetInfo(asset).symbol}</span>
            <input
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, "").slice(0, 24))}
              placeholder="0.00"
              aria-label={`Amount in ${asset}`}
              aria-invalid={raw !== "" && !valid}
              className="display num h-full min-w-0 flex-1 bg-transparent text-[24px] font-extrabold outline-none placeholder:text-muted/50 focus-visible:outline-none"
            />
          </label>
          {raw !== "" && !valid && <p className="mt-1.5 text-[12px] text-error-600">Enter a positive amount with at most {decimals} decimals.</p>}
        </div>

        {vault && valid && (
          <div className="rounded-chip border-2 border-edge bg-sunken p-3.5" aria-live="polite">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">After approval</div>
            <div className="num mt-1 text-[13px]">
              <span className="text-muted">{fmtMoney(asset, vault.balance)}</span> <span aria-hidden>→</span>{" "}
              <b className="text-success-600 dark:text-success-300">+{fmtMoney(asset, clean)}</b>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">Posts Dr Company Vault / Cr Treasury Funding once a second admin approves.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <label className="block">
            <Label>Bank / transfer reference</Label>
            <input name="externalReference" required minLength={3} maxLength={64} placeholder="e.g. NIP-000123456789" className={input} />
          </label>
          <label className="block">
            <Label>Note <span className="font-normal normal-case text-muted">(optional)</span></Label>
            <input name="note" maxLength={200} placeholder="e.g. Weekend float" className={input} />
          </label>
        </div>
      </fieldset>

      {state && !state.ok && <p role="alert" className="text-[12.5px] font-medium text-error-600">{state.message}</p>}
      <button type="submit" disabled={pending || !canRequest || !valid} className={buttonClass("primary", "md", "h-12 w-full text-[14px]")}>
        {pending ? "Recording…" : valid ? `Request ${fmtMoney(asset, clean)}` : "Enter an amount"}
      </button>
      {!canRequest && <p className="flex items-center gap-1.5 text-[12px] text-muted"><Icon name="lock" size={13} /> Needs “Record treasury funding”.</p>}
    </form>
  );
}

function Label({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <span className="mb-2 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider">
      {n && <span className="grid size-5 place-items-center rounded-full bg-ink-900 text-[10.5px] text-white dark:bg-white dark:text-ink-900">{n}</span>}
      {children}
    </span>
  );
}
