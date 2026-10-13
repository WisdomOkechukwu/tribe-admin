import { StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { AssetIcon, Money } from "@/components/ui/Money";
import type { AssetCode, BalanceMovement, InventoryMovement, Leg } from "@/lib/domain/types";
import { fmtAmount, fmtPct, fmtRate, fmtTime } from "@/lib/format";

// Pure presentational component: used by the server-rendered detail page and
// by the client quick-view drawer.

const KIND_LABEL: Record<Leg["kind"], string> = {
  debit_wallet: "Wallet debit", credit_wallet: "Wallet credit", convert: "Conversion", fee: "Fee",
  provider_payout: "Provider payout", provider_purchase: "Provider purchase", provider_collect: "Provider collection",
  card_load: "Card load", card_unload: "Card unload", escrow_hold: "Escrow hold", escrow_release: "Escrow release",
};

const DOT: Record<Leg["status"], string> = {
  completed: "bg-success-500", pending: "bg-warning-500", failed: "bg-error-500", reversed: "bg-orange-500",
};

export type People = Record<string, { name: string; tag: string }>;
export type Pools = Record<string, { provider: string; label: string; kind: "book" | "asset"; asset: AssetCode }>;

/** Human rate: always show the larger side ("1 BTC = 151,536,000 NGN", not 6.6e-9). */
function Rate({ from, to, rate }: { from: AssetCode; to: AssetCode; rate: number }) {
  return rate >= 1 ? <span className="num">1 {from} = {fmtRate(rate)} {to}</span> : <span className="num">1 {to} = {fmtRate(1 / rate)} {from}</span>;
}

function Delta({ asset, delta }: { asset: AssetCode; delta: number }) {
  return (
    <span className={cx("num font-bold whitespace-nowrap", delta < 0 ? "text-error-600 dark:text-error-50" : "text-success-600 dark:text-success-300")}>
      {delta < 0 ? "−" : "+"}{fmtAmount(asset, Math.abs(delta))}
    </span>
  );
}

/** Before → change → after table, for either side of the ledger. */
function MoveTable({ title, tone, rows }: { title: string; tone: "customer" | "system"; rows: { key: string; label: React.ReactNode; asset: AssetCode; before: number; delta: number; after: number }[] }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-chip border-2 border-line">
      <table className="w-full text-[12px]">
        <thead className={cx("text-[10.5px] font-bold uppercase tracking-wider", tone === "customer" ? "bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100" : "bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-100")}>
          <tr>
            <th className="px-2.5 py-1.5 text-left">{title}</th>
            <th className="px-2.5 py-1.5 text-right">Previous</th>
            <th className="px-2.5 py-1.5 text-right">Change</th>
            <th className="px-2.5 py-1.5 text-right">Current</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="px-2.5 py-1.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><AssetIcon asset={r.asset} size={14} />{r.label}</span></td>
              <td className="num px-2.5 py-1.5 text-right whitespace-nowrap text-muted">{fmtAmount(r.asset, r.before)}</td>
              <td className="px-2.5 py-1.5 text-right"><Delta asset={r.asset} delta={r.delta} /></td>
              <td className="num px-2.5 py-1.5 text-right font-semibold whitespace-nowrap">{fmtAmount(r.asset, r.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const custRows = (bs: BalanceMovement[], people: People) =>
  bs.map((b, i) => ({
    key: `c${i}`,
    asset: b.asset,
    before: b.before,
    delta: b.delta,
    after: b.after,
    label: (
      <span>
        {people[b.customerId] ? `@${people[b.customerId].tag}` : "Customer"} · <b>{b.account === "card" ? `Card •• ${b.cardLast4}` : `${b.asset} wallet`}</b>
      </span>
    ),
  }));

const sysRows = (ms: InventoryMovement[], pools: Pools) =>
  ms.map((m, i) => ({ key: `s${i}`, asset: pools[m.poolId]?.asset ?? "NGN", before: m.before, delta: m.delta, after: m.after, label: <b>{pools[m.poolId]?.label ?? m.poolId}</b> }));

export function LegTimeline({ legs, pools, people, compact }: { legs: Leg[]; pools: Pools; people: People; compact?: boolean }) {
  return (
    <ol className="relative">
      {legs.map((l, i) => (
        <li key={l.seq} className="relative pb-6 pl-11 last:pb-0">
          {i < legs.length - 1 && <span className="absolute top-8 bottom-1 left-[15px] w-0.5 rounded-full bg-line" aria-hidden />}
          <span className="absolute top-0 left-0 grid size-8 place-items-center rounded-full border-2 border-edge bg-surface text-[12px] font-extrabold shadow-hard-sm">
            {l.seq}
            <span className={cx("absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-[var(--surface)]", DOT[l.status])} aria-hidden />
          </span>

          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-200">{KIND_LABEL[l.kind]}</span>
              <div className="text-[14px] font-semibold">{l.label}</div>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="num">{fmtTime(l.at)}</span>
              <StatusPill status={l.status} />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            {l.from && <span className="inline-flex items-center gap-1"><span className="text-muted">From</span><Money asset={l.from.asset} amount={l.from.amount} icon /></span>}
            {l.to && <span className="inline-flex items-center gap-1"><span className="text-muted">To</span><Money asset={l.to.asset} amount={l.to.amount} icon /></span>}
            {l.fee && <span className="inline-flex items-center gap-1"><span className="text-muted">Fee</span><Money asset={l.fee.asset} amount={l.fee.amount} icon /></span>}
            {l.provider && !compact && <span className="text-muted">via <span className="font-medium text-fg">{l.provider}</span>{l.providerRef && <span className="font-mono"> · {l.providerRef}</span>}</span>}
          </div>

          {l.kind === "convert" && l.baseRate !== undefined && l.appliedRate !== undefined && l.from && l.to && (
            <div className="mt-2 grid grid-cols-1 gap-2 rounded-chip bg-sunken p-2.5 text-[12px] sm:grid-cols-3">
              <div><div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Base rate</div><Rate from={l.from.asset} to={l.to.asset} rate={l.baseRate} /></div>
              <div><div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Applied rate</div><Rate from={l.from.asset} to={l.to.asset} rate={l.appliedRate} /></div>
              <div><div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Rate markup</div><span className="num font-bold">{fmtPct(l.rateMarkupPct ?? 0, 3)}</span></div>
            </div>
          )}

          {(l.balances.length > 0 || l.inventory.length > 0) && (
            <div className={cx("mt-2.5 grid grid-cols-1 gap-2", !compact && l.balances.length > 0 && l.inventory.length > 0 && "2xl:grid-cols-2")}>
              {l.balances.length > 0 && <MoveTable title="Customer balance" tone="customer" rows={custRows(l.balances, people)} />}
              {l.inventory.length > 0 && <MoveTable title="System balance" tone="system" rows={sysRows(l.inventory, pools)} />}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

type CustImpact = { key: string; customerId: string; account: "wallet" | "card"; asset: AssetCode; cardLast4?: string; before: number; after: number; delta: number; now: number };
type SysImpact = { poolId: string; provider: string; label: string; asset: AssetCode; before: number; after: number; delta: number; now: number };

function ImpactBlock({ title, tone, rows }: { title: string; tone: "customer" | "system"; rows: { key: string; label: React.ReactNode; asset: AssetCode; before: number; after: number; delta: number; now: number }[] }) {
  return (
  <div className="min-w-0">
    <div className={cx("mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", tone === "customer" ? "bg-purple-500 text-white" : "bg-orange-500 text-ink-900")}>{title}</div>
    {rows.length === 0 ? (
      <p className="text-[12.5px] text-muted">{tone === "customer" ? "No customer balance changed." : "No NGN book or asset pool moved (internal ledger only, or the leg didn't complete)."}</p>
    ) : (
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="rounded-chip border-2 border-line p-3">
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold"><AssetIcon asset={r.asset} size={18} /><span className="truncate">{r.label}</span></span>
              <Delta asset={r.asset} delta={r.delta} />
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
              <div><dt className="text-muted">Previous</dt><dd className="num font-medium">{fmtAmount(r.asset, r.before)}</dd></div>
              <div><dt className="text-muted">After this tx</dt><dd className="num font-medium">{fmtAmount(r.asset, r.after)}</dd></div>
              <div><dt className="text-muted">Live now</dt><dd className="num font-bold">{fmtAmount(r.asset, r.now)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    )}
  </div>
);
}

/** Whole-transaction summary: previous / after / live balance, customer and system side. */
export function BalanceImpact({ customer, system, people }: { customer: CustImpact[]; system: SysImpact[]; people: People }) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <ImpactBlock
        title="Customer balance"
        tone="customer"
        rows={customer.map((c) => ({ ...c, label: <>{people[c.customerId] ? `@${people[c.customerId].tag}` : "Customer"} · {c.account === "card" ? `Card •• ${c.cardLast4}` : `${c.asset} wallet`}</> }))}
      />
      <ImpactBlock title="System balance" tone="system" rows={system.map((s) => ({ ...s, key: s.poolId, label: <>{s.label}</> }))} />
    </div>
  );
}
