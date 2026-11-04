"use client";

import { useEffect, useTransition } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Modal } from "@/components/ui/Modal";
import { AssetIcon } from "@/components/ui/Money";
import { Toggle } from "@/components/ui/Toggle";
import { saveFees, saveMargins } from "@/lib/actions/admin";
import { CATEGORIES, assetInfo, typeLabel } from "@/lib/domain/catalog";
import type { RateMargin, TransactionFee } from "@/lib/domain/types";
import { useCan } from "@/stores/access-store";
import { changedPricing, isAmount, isPct, useDirtyCount, useFeeDirty, useHasInvalid, useMarginDirty, usePricing, type FeeField, type MarginField } from "@/stores/markup-store";
import { toast } from "@/stores/toast-store";

/** Opens the pricing modal from anywhere (top bar, transactions page). */
export function MarkupsButton({ size = "md" }: { size?: "sm" | "md" }) {
  const show = usePricing((s) => s.show);
  const allowed = useCan("markups.view");
  if (!allowed) return null;
  return (
    <Button variant="secondary" size={size} onClick={() => show()}>
      <Icon name="markup" size={15} />
      Fees & margins
    </Button>
  );
}

function Cell({ value, onChange, suffix, invalid, disabled, label, placeholder }: { value: string; onChange: (v: string) => void; suffix: string; invalid: boolean; disabled: boolean; label: string; placeholder?: string }) {
  return (
    <label className={cx("flex h-8 w-full min-w-24 items-center rounded-chip border bg-surface pr-2 focus-within:border-purple-300", invalid ? "border-error-500" : "border-line", disabled && "opacity-60")}>
      <input
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={invalid}
        className="num h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[12.5px] outline-none placeholder:text-muted/60 focus-visible:outline-none"
      />
      <span className="text-[11.5px] text-muted">{suffix}</span>
    </label>
  );
}

function MarginRow({ asset, disabled }: { asset: string; disabled: boolean }) {
  const d = usePricing((s) => s.margins[asset]);
  const set = usePricing((s) => s.setMargin);
  const dirty = useMarginDirty(asset);
  if (!d) return null;
  const cell = (f: MarginField, label: string) => <Cell value={d[f]} onChange={(v) => set(asset, f, v)} suffix="%" invalid={!isPct(d[f], 25)} disabled={disabled} label={`${asset} ${label}`} />;
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-3 pl-5">
        <div className="flex items-center gap-2 font-medium">
          <AssetIcon asset={asset} size={18} /> {asset}
          {dirty && <span className="size-1.5 rounded-full bg-orange-500" aria-label="Unsaved change" />}
        </div>
        <div className="text-[11.5px] text-muted">{assetInfo(asset).name}</div>
      </td>
      <td className="px-2 py-2">{cell("buyPct", "buy margin")}</td>
      <td className="px-2 py-2">{cell("sellPct", "sell margin")}</td>
    </tr>
  );
}

function FeeRow({ type, disabled }: { type: string; disabled: boolean }) {
  const d = usePricing((s) => s.fees[type]);
  const set = usePricing((s) => s.setFee);
  const toggle = usePricing((s) => s.toggleFee);
  const dirty = useFeeDirty(type);
  if (!d) return null;
  const cell = (f: FeeField, suffix: string, invalid: boolean, label: string, placeholder?: string) => <Cell value={d[f]} onChange={(v) => set(type, f, v)} suffix={suffix} invalid={invalid} disabled={disabled} label={`${typeLabel(type)} ${label}`} placeholder={placeholder} />;
  return (
    <tr className={cx("border-b border-line last:border-0", !d.active && "text-muted")}>
      <td className="py-2 pr-3 pl-5">
        <div className="flex items-center gap-2 font-medium">
          {typeLabel(type)}
          {dirty && <span className="size-1.5 rounded-full bg-orange-500" aria-label="Unsaved change" />}
        </div>
        <div className="font-mono text-[11px] text-muted">{type}</div>
      </td>
      <td className="px-2 py-2">{cell("feePct", "%", !isPct(d.feePct, 10), "fee percent")}</td>
      <td className="px-2 py-2">{cell("flatFee", d.flatFeeAsset, !isAmount(d.flatFee), "flat fee")}</td>
      <td className="px-2 py-2">{cell("maxFee", d.flatFeeAsset, d.maxFee !== "" && !isAmount(d.maxFee), "fee cap", "No cap")}</td>
      <td className="py-2 pr-5 pl-2">
        <div className="flex items-center justify-end gap-2">
          <span className="w-14 text-right text-[11.5px]">{d.active ? "Active" : "Off"}</span>
          <Toggle on={d.active} onChange={(on) => toggle(type, on)} label={`${typeLabel(type)} fee active`} disabled={disabled} />
        </div>
      </td>
    </tr>
  );
}

const TH = "px-2 py-2 font-medium";

/** Tabs + tables + save bar. Used inside the modal and inline on /rates. */
export function PricingEditor({ margins, fees, canEdit, inline }: { margins: RateMargin[]; fees: TransactionFee[]; canEdit: boolean; inline?: boolean }) {
  const tab = usePricing((s) => s.tab);
  const setTab = usePricing((s) => s.setTab);
  const load = usePricing((s) => s.load);
  const reset = usePricing((s) => s.reset);
  const dirty = useDirtyCount();
  const invalid = useHasInvalid();
  const [saving, start] = useTransition();

  useEffect(() => {
    load(margins, fees);
  }, [margins, fees, load]);

  const save = () =>
    start(async () => {
      const { margins: m, fees: f } = changedPricing();
      const results = [];
      if (m.length) results.push(await saveMargins(m));
      if (f.length) results.push(await saveFees(f));
      const failed = results.find((r) => !r.ok);
      if (failed) toast.error(failed.message);
      else toast.success(results.map((r) => r.message).join(" ") || "No changes to save.");
    });

  return (
    <div className={cx("flex min-h-0 flex-col", inline && "card overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line px-5 py-3">
        <div className="inline-flex gap-1 rounded-full border-2 border-edge bg-surface p-1" role="tablist" aria-label="Pricing">
          {(["margins", "fees"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("press inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-[12.5px] font-semibold", tab === t ? "bg-ink-900 text-white dark:bg-orange-500 dark:text-ink-900" : "text-fg/70 hover:bg-orange-100 dark:hover:bg-orange-900/50")}>
              {t === "margins" ? `Rate margins · ${margins.length}` : `Transaction fees · ${fees.length}`}
            </button>
          ))}
        </div>
        <p className="max-w-xl text-[12px] text-muted">
          {tab === "margins" ? "Margin applied to the provider rate when a customer buys (we sell) or sells (we buy) the asset. Percent, up to 25%." : "Charged per transaction: a % of the amount plus a flat fee, capped at the max fee if set. Inactive rules charge nothing."}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" data-lenis-prevent>
        {tab === "margins" ? (
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="sticky top-0 z-[1] bg-sunken text-[11.5px] uppercase tracking-wide text-muted">
              <tr><th className="py-2 pr-3 pl-5 font-medium">Asset</th><th className={TH}>Buy margin</th><th className={TH}>Sell margin</th></tr>
            </thead>
            <tbody>{margins.map((m) => <MarginRow key={m.asset} asset={m.asset} disabled={!canEdit} />)}</tbody>
          </table>
        ) : (
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="sticky top-0 z-[1] bg-sunken text-[11.5px] uppercase tracking-wide text-muted">
              <tr><th className="py-2 pr-3 pl-5 font-medium">Transaction type</th><th className={TH}>Fee %</th><th className={TH}>Flat fee</th><th className={TH}>Max fee</th><th className="py-2 pr-5 pl-2 text-right font-medium">Status</th></tr>
            </thead>
            {CATEGORIES.map((c) => {
              const rows = fees.filter((f) => f.category === c.id);
              if (!rows.length) return null;
              return (
                <tbody key={c.id}>
                  <tr><th colSpan={5} className="bg-surface px-5 pt-4 pb-1 text-[11.5px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-200">{c.label}</th></tr>
                  {rows.map((f) => <FeeRow key={f.type} type={f.type} disabled={!canEdit} />)}
                </tbody>
              );
            })}
          </table>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-line bg-sunken px-5 py-3">
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          {canEdit ? (
            dirty > 0 ? <Button size="sm" variant="ghost" onClick={reset} disabled={saving}>Reset</Button> : <span>Edits are saved per row, with the row&apos;s version (no lost updates).</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Icon name="lock" size={13} /> Read only: needs “Change fees & margins”.</span>
          )}
        </div>
        {canEdit && (
          <Button variant="primary" onClick={save} disabled={!dirty || saving || invalid}>
            {saving ? "Saving…" : invalid ? "Fix highlighted values" : dirty ? `Save ${dirty} change${dirty > 1 ? "s" : ""}` : "Saved"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function MarkupModal({ margins, fees, canEdit }: { margins: RateMargin[]; fees: TransactionFee[]; canEdit: boolean }) {
  const open = usePricing((s) => s.open);
  const close = usePricing((s) => s.close);
  const reset = usePricing((s) => s.reset);
  const dirty = useDirtyCount();

  const onClose = () => {
    if (dirty) reset();
    close();
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Fees & margins" subtitle="Rate margins per asset and fees per transaction type, live from the API.">
      {open && <PricingEditor margins={margins} fees={fees} canEdit={canEdit} />}
    </Modal>
  );
}
