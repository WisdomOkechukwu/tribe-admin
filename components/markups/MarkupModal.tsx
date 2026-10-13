"use client";

import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { saveMarkups } from "@/lib/actions/admin";
import { ASSETS, CATEGORIES, typeLabel } from "@/lib/domain/catalog";
import type { MarkupRule, TxType } from "@/lib/domain/types";
import { fmtUsd } from "@/lib/format";
import { changedDrafts, useDirtyCount, useMarkups, useRowDirty } from "@/stores/markup-store";
import { useCan } from "@/stores/access-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/shell/icons";

/** Opens the markup modal from anywhere (top bar, transactions page). */
export function MarkupsButton({ size = "md" }: { size?: "sm" | "md" }) {
  const show = useMarkups((s) => s.show);
  const allowed = useCan("markups.view");
  if (!allowed) return null;
  return (
    <Button variant="secondary" size={size} onClick={show}>
      <Icon name="markup" size={15} />
      Markups
    </Button>
  );
}

function NumCell({ t, f, suffix, disabled, max }: { t: TxType; f: "ratePct" | "feePct" | "flatFee"; suffix: string; disabled: boolean; max: number }) {
  const text = useMarkups((s) => s.text[`${t}.${f}`] ?? "");
  const setField = useMarkups((s) => s.setField);
  const n = Number(text);
  const invalid = text.trim() === "" || !Number.isFinite(n) || n < 0 || n > max;
  return (
    <label className={cx("flex h-8 w-full min-w-24 items-center rounded-chip border bg-surface pr-2 focus-within:border-purple-300", invalid ? "border-error-500" : "border-line", disabled && "opacity-60")}>
      <input
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onChange={(e) => setField(t, f, e.target.value)}
        aria-label={`${typeLabel(t)} ${f === "ratePct" ? "rate markup" : f === "feePct" ? "fee markup" : "flat fee"}`}
        aria-invalid={invalid}
        className="num h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[12.5px] outline-none focus-visible:outline-none"
      />
      <span className="text-[11.5px] text-muted">{suffix}</span>
    </label>
  );
}

function Row({ rule, disabled }: { rule: MarkupRule; disabled: boolean }) {
  const t = rule.txType;
  const d = useMarkups((s) => s.draft[t]);
  const toggle = useMarkups((s) => s.toggle);
  const dirty = useRowDirty(t);
  if (!d) return null;
  // Illustrative earnings on a $100 transaction.
  const earn = d.active ? d.ratePct + d.feePct + d.flatFee * ASSETS[rule.flatFeeAsset].usd : 0;
  return (
    <tr className={cx("border-b border-line last:border-0", !d.active && "text-muted")}>
      <td className="py-2 pr-3 pl-5">
        <div className="flex items-center gap-2 font-medium">
          {typeLabel(t)}
          {dirty && <span className="size-1.5 rounded-full bg-orange-500" aria-label="Unsaved change" />}
        </div>
        <div className="text-[11.5px] text-muted">On $100: {fmtUsd(earn)}</div>
      </td>
      <td className="px-2 py-2"><NumCell t={t} f="ratePct" suffix="%" disabled={disabled} max={25} /></td>
      <td className="px-2 py-2"><NumCell t={t} f="feePct" suffix="%" disabled={disabled} max={10} /></td>
      <td className="px-2 py-2"><NumCell t={t} f="flatFee" suffix={rule.flatFeeAsset} disabled={disabled} max={100_000} /></td>
      <td className="py-2 pr-5 pl-2">
        <div className="flex items-center justify-end gap-2">
          <span className="w-14 text-right text-[11.5px]">{d.active ? "Active" : "Off"}</span>
          <Toggle on={d.active} onChange={(on) => toggle(t, on)} label={`${typeLabel(t)} markup active`} disabled={disabled} />
        </div>
      </td>
    </tr>
  );
}

export function MarkupModal({ rules, canEdit }: { rules: MarkupRule[]; canEdit: boolean }) {
  const open = useMarkups((s) => s.open);
  const close = useMarkups((s) => s.close);
  const load = useMarkups((s) => s.load);
  const reset = useMarkups((s) => s.reset);
  const setAll = useMarkups((s) => s.setAll);
  const dirty = useDirtyCount();
  const [saving, start] = useTransition();

  useEffect(() => {
    if (open) load(rules);
  }, [open, rules, load]);

  const save = () =>
    start(async () => {
      const res = await saveMarkups(changedDrafts());
      if (res.ok) {
        toast.success(res.message);
        useMarkups.getState().commit();
      } else toast.error(res.message);
    });

  const onClose = () => {
    if (dirty && !saving) reset();
    close();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Markups"
      subtitle="Rate markup and fee apply on EVERY conversion leg (e.g. BTC → Crypto NGN, then Fiat NGN → GBP); the fee is a % of that leg's from-asset. Flat fee is charged once per transaction. Inactive rules charge nothing."
      footer={
        <>
          <div className="flex items-center gap-2 text-[12.5px] text-muted">
            {canEdit ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setAll(true)}>Activate all</Button>
                <Button size="sm" variant="ghost" onClick={() => setAll(false)}>Deactivate all</Button>
                {dirty > 0 && <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Icon name="lock" size={13} /> Read only: needs “Change markups”.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>
            {canEdit && (
              <Button variant="primary" onClick={save} disabled={!dirty || saving}>
                {saving ? "Saving…" : dirty ? `Save ${dirty} change${dirty > 1 ? "s" : ""}` : "Saved"}
              </Button>
            )}
          </div>
        </>
      }
    >
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="sticky top-0 z-[1] bg-sunken text-[11.5px] uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2 pr-3 pl-5 font-medium">Transaction type</th>
            <th className="px-2 py-2 font-medium">Rate markup</th>
            <th className="px-2 py-2 font-medium">Fee (of from-asset)</th>
            <th className="px-2 py-2 font-medium">Flat fee</th>
            <th className="py-2 pr-5 pl-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        {CATEGORIES.map((c) => (
          <tbody key={c.id}>
            <tr>
              <th colSpan={5} className="bg-surface px-5 pt-4 pb-1 text-[11.5px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-200">{c.label}</th>
            </tr>
            {rules.filter((r) => r.category === c.id).map((r) => (
              <Row key={r.txType} rule={r} disabled={!canEdit} />
            ))}
          </tbody>
        ))}
      </table>
    </Modal>
  );
}
