"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/shell/icons";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { AssetIcon, Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { previewTransaction } from "@/lib/actions/admin";
import { typeLabel } from "@/lib/domain/catalog";
import { fmtDateTime, fmtInt, fmtUsd } from "@/lib/format";
import { useTxDrawer } from "@/stores/tx-drawer-store";
import { BalanceImpact, LegTimeline } from "./LegTimeline";
import { Route, routeOf } from "./Route";

type Preview = NonNullable<Awaited<ReturnType<typeof previewTransaction>>>;

// Legs are fetched on demand (server action) and memoised per id, so lists
// stay light: rows never ship their legs.
const cache = new Map<string, Preview | null>();

/** Opens the quick view for a transaction. */
export function LegsButton({ id, count }: { id: string; count: number }) {
  const show = useTxDrawer((s) => s.show);
  return (
    <button type="button" onClick={() => show(id)} className="pop inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-surface px-2.5 text-[11.5px] font-bold" aria-label={`View ${count} legs`}>
      <Icon name="legs" size={13} />
      {count} legs
    </button>
  );
}

export function TxDrawer() {
  const id = useTxDrawer((s) => s.id);
  const close = useTxDrawer((s) => s.close);
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<{ id: string; v: Preview | null } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id && !d.open) d.showModal();
    if (!id && d.open) d.close();
    if (!id) return;
    if (cache.has(id)) return;
    let alive = true;
    previewTransaction(id).then((v) => {
      cache.set(id, v);
      if (alive) setData({ id, v });
    });
    return () => { alive = false; };
  }, [id]);

  const p = id ? (cache.get(id) ?? (data?.id === id ? data.v : undefined)) : undefined;

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
      aria-label="Transaction quick view"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[640px] overflow-hidden border-0 border-l-2 border-edge bg-bg p-0 text-fg shadow-hard backdrop:bg-ink-900/40"
    >
      {id && (
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-3 border-b-2 border-edge bg-surface px-5 py-3.5">
            <span className="display text-[22px] font-extrabold uppercase">Quick view</span>
            <div className="flex items-center gap-2">
              {p && <Link href={`/transactions/${p.tx.id}`} onClick={close} className={buttonClass("ink", "sm")}>Full page <Icon name="arrow" size={13} /></Link>}
              <button type="button" onClick={close} className="pop grid size-9 cursor-pointer place-items-center rounded-full bg-surface" aria-label="Close"><Icon name="close" size={14} /></button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5" data-lenis-prevent>
            {p === undefined ? (
              <div className="space-y-4" role="status" aria-label="Loading">
                <Skeleton className="h-28 rounded-card" /><Skeleton className="h-48 rounded-card" /><Skeleton className="h-64 rounded-card" />
              </div>
            ) : p === null ? (
              <p className="text-muted">Transaction not found.</p>
            ) : (
              <div className="space-y-5">
                <section className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="purple">{typeLabel(p.tx.type)}</Badge>
                    <StatusPill status={p.tx.status} />
                    <span className="font-mono text-[12px] text-muted">{p.tx.reference}</span>
                  </div>
                  <h2 className="display mt-2 text-[26px] font-extrabold uppercase">{p.tx.title}</h2>
                  <div className="mt-2"><Route assets={routeOf(p.tx)} /></div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                    <div>
                      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{p.tx.direction === "in" ? "Received in" : "Paid with"}</dt>
                      <dd className="mt-1 flex items-center gap-1.5 font-semibold"><AssetIcon asset={p.tx.source.asset} size={18} /><Money asset={p.tx.source.asset} amount={p.tx.source.amount} /></dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{p.tx.direction === "in" ? "Credited" : "Delivered"}</dt>
                      <dd className="mt-1 font-semibold">{p.tx.destination ? <Money asset={p.tx.destination.asset} amount={p.tx.destination.amount} icon /> : "—"}</dd>
                    </div>
                    <div><dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Fee</dt><dd className="mt-1">{p.tx.fee.amount ? <Money asset={p.tx.fee.asset} amount={p.tx.fee.amount} icon /> : "None"}</dd></div>
                    <div><dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Revenue · value</dt><dd className="num mt-1">₦{fmtInt(p.tx.markupRevenueNgn)} · ≈{fmtUsd(p.tx.usdValue)}</dd></div>
                  </dl>
                  {p.customer && <p className="mt-3 text-[12.5px] text-muted">{fmtDateTime(p.tx.createdAt)} · <Link onClick={close} className="font-semibold text-fg underline decoration-2 underline-offset-2" href={`/customers/${p.customer.id}`}>{p.customer.firstName} {p.customer.lastName}</Link> @{p.customer.tag}</p>}
                  {p.tx.failureReason && <p className="mt-3 rounded-chip bg-error-50 px-3 py-2 text-[12.5px] font-medium text-error-600 dark:bg-error-600/20 dark:text-error-50">{p.tx.failureReason}</p>}
                </section>
                <section className="card p-4">
                  <h3 className="display mb-3 text-[18px] font-bold uppercase">Balances</h3>
                  <BalanceImpact customer={p.customerImpact} system={p.systemImpact} people={p.people} />
                </section>
                <section className="card p-4">
                  <h3 className="display mb-4 text-[18px] font-bold uppercase">Legs · {p.tx.legs.length}</h3>
                  <LegTimeline legs={p.tx.legs} pools={p.pools} people={p.people} compact />
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
