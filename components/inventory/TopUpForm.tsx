"use client";

import { useActionState, useState } from "react";
import { Icon, type IconName } from "@/components/shell/icons";
import { buttonClass } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { topUpInventory, type ActionResult } from "@/lib/actions/admin";
import { BOOKS } from "@/lib/domain/catalog";
import { fmtMoney } from "@/lib/format";
import { toast } from "@/stores/toast-store";

export type BookOpt = { id: string; label: string; balance: number; lowThreshold: number; topup: boolean };

const QUICK = [1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000];
const short = (n: number) => (n >= 1e9 ? `₦${+(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `₦${+(n / 1e6).toFixed(2)}M` : `₦${+(n / 1e3).toFixed(1)}K`);

/** Add naira to an NGN book. Every book except Cashpoint NGN (escrow). */
export function TopUpForm({ books, canEdit }: { books: BookOpt[]; canEdit: boolean }) {
  const [bookId, setBookId] = useState("local-ngn");
  const book = books.find((b) => b.id === bookId)!;
  const [raw, setRaw] = useState("");
  const ngn = Number(raw.replace(/[^\d]/g, "")) || 0;

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const res = await topUpInventory(prev, fd);
    if (res.ok) { toast.success(res.message); setRaw(""); } else toast.error(res.message);
    return res;
  }, null);

  const input = "h-11 w-full rounded-chip border-2 border-edge bg-surface px-3.5 text-[13.5px] outline-none focus:border-purple-500 focus:shadow-hard-sm focus-visible:outline-none disabled:opacity-60";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="poolId" value={bookId} />
      <input type="hidden" name="amount" value={ngn || ""} />

      <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-60">
        <div>
          <Label n={1}>Which NGN book?</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2" role="radiogroup" aria-label="NGN book">
            {BOOKS.map((meta) => {
              const b = books.find((x) => x.id === meta.id)!;
              const low = b.lowThreshold > 0 && b.balance < b.lowThreshold * 1.5;
              const on = bookId === meta.id;
              if (!meta.topup)
                return (
                  <div key={meta.id} className="flex items-center gap-2.5 rounded-chip border-2 border-dashed border-line p-2.5 text-muted" title="Escrow: managed by the system">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-line"><Icon name="lock" size={14} /></span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] leading-tight font-extrabold">{meta.label}</span>
                      <span className="block text-[10.5px]">Escrow · no top-ups</span>
                    </span>
                  </div>
                );
              return (
                <button
                  key={meta.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setBookId(meta.id)}
                  className={cx("pop flex cursor-pointer items-center gap-2.5 rounded-chip p-2.5 text-left", on ? "bg-orange-500 text-ink-900" : "bg-surface")}
                >
                  <span className={cx("relative grid size-8 shrink-0 place-items-center rounded-full border-2 border-edge", on ? "bg-ink-900 text-white" : "bg-sunken")}>
                    <Icon name={meta.icon as IconName} size={14} />
                    {low && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-edge bg-error-500" aria-label="low" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] leading-tight font-extrabold">{meta.label}</span>
                    <span className={cx("num block truncate text-[10.5px]", on ? "text-ink-800" : "text-muted")}>{short(b.balance)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">{BOOKS.find((b) => b.id === bookId)?.purpose}</p>
        </div>

        <div>
          <Label n={2}>Amount to add</Label>
          <label className="flex h-14 items-center gap-2 rounded-chip border-2 border-edge bg-surface px-4 focus-within:border-purple-500 focus-within:shadow-hard-sm">
            <span className="display text-[26px] font-extrabold text-muted">₦</span>
            <input
              inputMode="numeric"
              value={raw}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 13);
                setRaw(digits ? Number(digits).toLocaleString("en-NG") : "");
              }}
              placeholder="0"
              aria-label="Amount in NGN"
              className="display num h-full min-w-0 flex-1 bg-transparent text-[26px] font-extrabold outline-none placeholder:text-muted/50 focus-visible:outline-none"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setRaw(q.toLocaleString("en-NG"))} className={cx("pop h-7 cursor-pointer rounded-full px-2.5 text-[11.5px] font-bold", ngn === q ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900" : "bg-surface")}>
                {short(q)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-chip border-2 border-edge bg-sunken p-3.5" aria-live="polite">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Preview</div>
          <div className="mt-1 text-[12.5px] font-semibold">{book.label}</div>
          <div className="num mt-1 text-[13px]">
            <span className="text-muted">{fmtMoney("NGN", book.balance)}</span> <span aria-hidden>→</span>{" "}
            <b className="text-success-600 dark:text-success-300">{fmtMoney("NGN", book.balance + ngn)}</b>
          </div>
          {book.lowThreshold > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className={cx("h-full rounded-full transition-[width]", book.balance + ngn < book.lowThreshold * 1.5 ? "bg-error-500" : "bg-success-500")} style={{ width: `${Math.min(100, ((book.balance + ngn) / (book.lowThreshold * 4)) * 100)}%` }} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="block">
            <Label>Bank / transfer reference</Label>
            <input name="externalRef" required maxLength={64} placeholder="e.g. NIP-000123456789" className={input} />
          </label>
          <label className="block">
            <Label>Note <span className="font-normal normal-case text-muted">(optional)</span></Label>
            <input name="note" maxLength={200} placeholder="e.g. Weekend float" className={input} />
          </label>
        </div>
      </fieldset>

      {state && !state.ok && <p role="alert" className="text-[12.5px] font-medium text-error-600">{state.message}</p>}
      <button type="submit" disabled={pending || !canEdit || !ngn} className={buttonClass("primary", "md", "h-12 w-full text-[14px]")}>
        {pending ? "Recording…" : ngn ? `Add ${short(ngn)} to ${book.label}` : "Enter an amount"}
      </button>
      {!canEdit && <p className="flex items-center gap-1.5 text-[12px] text-muted"><Icon name="lock" size={13} /> Needs “Record top-ups”.</p>}
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
