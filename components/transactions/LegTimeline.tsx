import Link from "next/link";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { AssetIcon, Money } from "@/components/ui/Money";
import type { JournalLeg, JournalView, SwapLeg } from "@/lib/domain/types";
import { fmtDateTime, fmtRate, fmtTime, toNum } from "@/lib/format";

// Pure presentational components for a transaction's money movement, used by
// the server-rendered detail page and by the client quick-view drawer:
// - SwapRoute: the conversion hops (swap_legs), with the rate and NGN rail.
// - JournalEntries: the double-entry journal (debit/credit legs per entry).

/** Human rate: always show the larger side ("1 BTC = 151,536,000 NGN", not 6.6e-9). */
function Rate({ from, to, rate }: { from: string; to: string; rate: string }) {
  const r = toNum(rate);
  if (!r) return <span className="num">—</span>;
  return r >= 1 ? <span className="num">1 {from} = {fmtRate(r)} {to}</span> : <span className="num">1 {to} = {fmtRate(1 / r)} {from}</span>;
}

export function SwapRoute({ legs, providers }: { legs: SwapLeg[]; providers?: Record<string, string> }) {
  if (!legs.length) return <p className="text-[12.5px] text-muted">No conversion: this transaction moved a single asset.</p>;
  const sorted = [...legs].sort((a, b) => a.step - b.step);
  return (
    <ol className="relative">
      {sorted.map((l, i) => (
        <li key={l.step} className="relative pb-5 pl-11 last:pb-0">
          {i < sorted.length - 1 && <span className="absolute top-8 bottom-1 left-[15px] w-0.5 rounded-full bg-line" aria-hidden />}
          <span className="absolute top-0 left-0 grid size-8 place-items-center rounded-full border-2 border-edge bg-surface text-[12px] font-extrabold shadow-hard-sm">{l.step}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold">{l.fromAsset} → {l.toAsset}</span>
            {l.viaNgnRail && <Badge tone="success">NGN rail</Badge>}
            {providers?.[l.providerId] && <span className="text-[12px] text-muted">via {providers[l.providerId]}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <span className="inline-flex items-center gap-1"><span className="text-muted">From</span><Money asset={l.fromAsset} amount={l.from} icon /></span>
            <span className="inline-flex items-center gap-1"><span className="text-muted">To</span><Money asset={l.toAsset} amount={l.to} icon /></span>
          </div>
          <div className="mt-2 rounded-chip bg-sunken px-2.5 py-1.5 text-[12px]">
            <span className="mr-2 text-[10.5px] font-bold uppercase tracking-wider text-muted">Applied rate</span>
            <Rate from={l.fromAsset} to={l.toAsset} rate={l.rate} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const CATEGORY_TONE: Record<string, "purple" | "orange" | "success" | "blue" | "warning" | "neutral"> = {
  asset: "blue", liability: "purple", suspense_liability: "warning", revenue: "success", equity: "orange", expense: "neutral",
};

export function LegsTable({ legs, compact, linkAccounts = true }: { legs: JournalLeg[]; compact?: boolean; linkAccounts?: boolean }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-chip border-2 border-line">
      <table className="w-full text-[12px]">
        <thead className="bg-sunken text-[10.5px] font-bold uppercase tracking-wider text-muted">
          <tr>
            <th className="px-2.5 py-1.5 text-left">Account</th>
            {!compact && <th className="px-2.5 py-1.5 text-left">Memo</th>}
            <th className="px-2.5 py-1.5 text-right">Debit</th>
            <th className="px-2.5 py-1.5 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((l) => (
            <tr key={l.id} className="border-t border-line">
              <td className="px-2.5 py-1.5">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <AssetIcon asset={l.asset} size={14} />
                  {linkAccounts ? <Link href={`/ledger?account=${l.ledgerAccountId}`} className="link font-semibold">{l.accountName}</Link> : <b>{l.accountName}</b>}
                  {!compact && <Badge tone={CATEGORY_TONE[l.accountCategory] ?? "neutral"}>{l.accountCategory.replace(/_/g, " ")}</Badge>}
                </span>
                {compact && l.memo && <div className="mt-0.5 text-[11px] text-muted">{l.memo}</div>}
              </td>
              {!compact && <td className="px-2.5 py-1.5 text-muted">{l.memo || "—"}</td>}
              <td className={cx("num px-2.5 py-1.5 text-right whitespace-nowrap", l.side === "debit" ? "font-bold" : "text-muted/40")}>{l.side === "debit" ? <Money asset={l.asset} amount={l.amount} /> : "—"}</td>
              <td className={cx("num px-2.5 py-1.5 text-right whitespace-nowrap", l.side === "credit" ? "font-bold" : "text-muted/40")}>{l.side === "credit" ? <Money asset={l.asset} amount={l.amount} /> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JournalEntries({ journal, compact }: { journal: JournalView[]; compact?: boolean }) {
  if (!journal.length) return <p className="text-[12.5px] text-muted">Nothing posted to the ledger for this transaction (yet).</p>;
  return (
    <ol className="space-y-5">
      {journal.map(({ entry, legs }) => (
        <li key={entry.id}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">{entry.description || entry.transactionType}</div>
              <div className="font-mono text-[11px] text-muted">
                <Link href={`/ledger?entry=${entry.id}`} className="link">{entry.reference}</Link>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="num" title={fmtDateTime(entry.postedAt)}>{fmtTime(entry.postedAt)}</span>
              <StatusPill status={entry.status === "posted" ? "completed" : entry.status} label={entry.status[0]?.toUpperCase() + entry.status.slice(1)} />
            </div>
          </div>
          <LegsTable legs={legs} compact={compact} />
        </li>
      ))}
    </ol>
  );
}
