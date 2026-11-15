"use client";

import { useActionState, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { AssetIcon } from "@/components/ui/Money";
import { Modal } from "@/components/ui/Modal";
import { Picker } from "@/components/ui/Picker";
import { requestAdjustment, type ActionResult } from "@/lib/actions/admin";
import { assetInfo } from "@/lib/domain/catalog";
import { addDecimal, compareDecimal } from "@/lib/domain/money";
import type { AdjustmentKind, FreeFunds } from "@/lib/domain/types";
import { fmtMoney, signOf } from "@/lib/format";
import { toast } from "@/stores/toast-store";

export type WalletOpt = { asset: string; balance: string };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Plain decimal for the amount box: "1,000.50" -> "1000.50", negatives -> "0". */
const plain = (v: string) => (signOf(v) < 0 ? "0" : v.replace(/,/g, ""));

/**
 * Step 1 of a manual credit or debit. The limit is shown up front and enforced:
 *   credit -> the currency's TRIBE FUNDS (Tribe's own money at the providers)
 *   debit  -> the customer's wallet balance
 * Nothing moves until a super admin (not the requester) approves; the API checks
 * the limit again then. One Idempotency-Key per submission.
 */
export function AdjustmentButton({ customerId, name, wallets, freeFunds }: { customerId: string; name: string; wallets: WalletOpt[]; freeFunds: FreeFunds[] | null }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AdjustmentKind>("credit");
  const creditAssets = (freeFunds ?? []).map((f) => f.asset as string);
  const debitAssets = wallets.filter((w) => signOf(w.balance) > 0).map((w) => w.asset);
  const options = kind === "credit" ? creditAssets : debitAssets;
  const [asset, setAsset] = useState(creditAssets.includes("NGN") ? "NGN" : creditAssets[0] ?? "NGN");
  const [raw, setRaw] = useState("");
  // made on the first submit (never while rendering, so the server and browser HTML match) and
  // reused if that same submission is retried; a successful one starts a fresh key
  const key = useRef<string | null>(null);

  const fund = freeFunds?.find((f) => f.asset === asset);
  const wallet = wallets.find((w) => w.asset === asset)?.balance ?? "0";
  const limit = kind === "credit" ? (fund ? plain(fund.tribeFunds) : null) : plain(wallet);
  const decimals = assetInfo(asset).decimals;
  const clean = raw.replace(/,/g, "");
  const wellFormed = /^\d+(\.\d+)?$/.test(clean) && /[1-9]/.test(clean) && (clean.split(".")[1]?.length ?? 0) <= decimals;
  const overLimit = wellFormed && limit !== null && compareDecimal(clean, limit) > 0;
  const valid = wellFormed && !overLimit && limit !== null;

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    key.current ??= newKey();
    fd.set("idempotencyKey", key.current);
    const res = await requestAdjustment(prev, fd);
    if (res.ok) {
      toast.success(res.message);
      setRaw("");
      key.current = null;
      setOpen(false);
    } else toast.error(res.message);
    return res;
  }, null);

  const switchKind = (next: AdjustmentKind) => {
    setKind(next);
    setRaw("");
    const list = next === "credit" ? creditAssets : debitAssets;
    if (!list.includes(asset)) setAsset(list[0] ?? asset);
  };

  const after = valid ? addDecimal(plain(wallet), kind === "credit" ? clean : `-${clean}`, decimals) : null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>Credit / debit</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Manual credit or debit" subtitle={`Move money into or out of ${name}'s wallet. A super admin must approve it before anything is posted.`}>
        <form action={action} className="space-y-5 p-5">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="asset" value={asset} />
          <input type="hidden" name="amount" value={clean} />
    
          <div role="radiogroup" aria-label="Credit or debit" className="grid grid-cols-2 gap-1 rounded-full border-2 border-edge bg-sunken p-1">
            {(["credit", "debit"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => switchKind(k)}
                className={`h-9 cursor-pointer rounded-full text-[13px] font-bold ${kind === k ? (k === "credit" ? "bg-success-600 text-white" : "bg-error-600 text-white") : "text-muted"}`}
              >
                {k === "credit" ? "+ Credit" : "− Debit"}
              </button>
            ))}
          </div>

          {options.length === 0 ? (
            <p className="rounded-chip border-2 border-edge bg-sunken p-3.5 text-[12.5px] text-muted">
              {kind === "credit" ? "Can't load Tribe Funds (needs “See inventory & ledger”, and an API that serves /free-funds), so crediting is off." : `${name} has no money in any wallet to debit.`}
            </p>
          ) : (
            <>
              <div>
                <Label>Currency</Label>
                <Picker
                  label="Currency"
                  value={asset}
                  onChange={(v) => { setAsset(v || asset); setRaw(""); }}
                  options={options.map((a) => {
                    const f = freeFunds?.find((x) => x.asset === a);
                    const w = wallets.find((x) => x.asset === a)?.balance ?? "0";
                    return { value: a, label: kind === "credit" ? `${a} · ${fmtMoney(a, f ? plain(f.tribeFunds) : "0")} in Tribe Funds` : `${a} · ${fmtMoney(a, w)} in wallet` };
                  })}
                />
              </div>

              {/* The limit, big, before the amount: what the admin can actually move */}
              <div className={`rounded-chip border-2 p-4 ${kind === "credit" ? "border-success-600/40 bg-success-600/5" : "border-error-600/40 bg-error-600/5"}`} aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{kind === "credit" ? "Available to credit" : "Available to debit"}</div>
                    <div className="display num mt-1 flex items-center gap-2 truncate text-[26px] font-extrabold">
                      <AssetIcon asset={asset} size={22} />
                      {limit === null ? "—" : fmtMoney(asset, limit)}
                    </div>
                  </div>
                  {limit !== null && signOf(limit) > 0 && (
                    <button type="button" onClick={() => setRaw(limit)} className={buttonClass("secondary", "sm")}>Use max</button>
                  )}
                </div>
                <p className="mt-1.5 text-[11.5px] text-muted">
                  {kind === "credit"
                    ? fund
                      ? <>Tribe Funds {asset}: the providers hold {fmtMoney(asset, fund.vaults)}, customers are owed {fmtMoney(asset, fund.owed)}. Only Tribe&apos;s own share is ever handed out.</>
                      : "Tribe Funds unavailable."
                    : `What ${name} holds in their ${asset} wallet right now.`}
                </p>
                {kind === "credit" && fund && signOf(fund.tribeFunds) <= 0 && (
                  <p className="mt-1.5 text-[12px] font-semibold text-error-600">Tribe has no {asset} of its own at the providers. Record treasury funding on Inventory first.</p>
                )}
              </div>

              <div>
                <Label>Amount</Label>
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
                {raw !== "" && !wellFormed && <p className="mt-1.5 text-[12px] text-error-600">Enter a positive amount with at most {decimals} decimals.</p>}
                {overLimit && limit !== null && <p className="mt-1.5 text-[12px] text-error-600">That&apos;s more than the {fmtMoney(asset, limit)} available.</p>}
                {after !== null && (
                  <p className="num mt-1.5 text-[12px] text-muted">
                    Wallet after approval: {fmtMoney(asset, plain(wallet))} <span aria-hidden>→</span> <b className={kind === "credit" ? "text-success-600" : "text-error-600"}>{fmtMoney(asset, after)}</b>
                  </p>
                )}
              </div>

              <label className="block">
                <Label>Reason (audit log{kind === "debit" ? " and the customer’s inbox" : ""})</Label>
                <textarea name="reason" required minLength={3} maxLength={200} rows={2} className="w-full rounded-chip border-2 border-edge bg-surface p-3 text-[13.5px] outline-none focus:border-purple-500 focus-visible:outline-none" placeholder={kind === "credit" ? "e.g. Refund for failed bill payment, ticket SUP-…" : "e.g. Reversing duplicate credit ADJ-…"} />
              </label>
            </>
          )}

          {state && !state.ok && <p role="alert" className="text-[12.5px] font-medium text-error-600">{state.message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant={kind === "credit" ? "primary" : "danger"} disabled={pending || !valid}>
              {pending ? "Requesting…" : valid ? `Request ${kind} of ${fmtMoney(asset, clean)}` : "Enter an amount"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[11.5px] font-bold uppercase tracking-wider">{children}</span>;
}
