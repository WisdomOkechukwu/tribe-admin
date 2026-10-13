import type { TxCategory } from "@/lib/domain/types";
import { fmtInt, fmtNgnCompact, fmtPct } from "@/lib/format";
import { CAT_COLOR, CAT_LIST } from "./cats";

/** Which products earn: share of 30-day markup + fees, and average kept per transaction. */
export function RevenueMix({ data }: { data: Record<TxCategory, { revenueNgn: number; count: number }> }) {
  const total = CAT_LIST.reduce((s, c) => s + data[c.id].revenueNgn, 0) || 1;
  const rows = CAT_LIST.map((c) => ({ ...c, ...data[c.id] })).sort((a, b) => b.revenueNgn - a.revenueNgn);
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Revenue share by product">
        {rows.map((r) => <div key={r.id} title={`${r.label}: ${fmtPct((r.revenueNgn / total) * 100, 1)}`} style={{ width: `${Math.max(1.5, (r.revenueNgn / total) * 100)}%`, background: CAT_COLOR[r.id] }} />)}
      </div>
      <table className="mt-3 w-full text-[12.5px]">
        <thead className="text-[10.5px] font-bold uppercase tracking-wider text-muted">
          <tr><th className="py-1 text-left">Product</th><th className="py-1 text-right">Kept</th><th className="py-1 text-right">Share</th><th className="py-1 text-right">Avg / tx</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="py-1.5"><span className="inline-flex items-center gap-1.5 font-semibold"><span className="size-2.5 rounded-full" style={{ background: CAT_COLOR[r.id] }} />{r.label}</span></td>
              <td className="num py-1.5 text-right font-bold">{fmtNgnCompact(r.revenueNgn)}</td>
              <td className="num py-1.5 text-right">{fmtPct((r.revenueNgn / total) * 100, 1)}</td>
              <td className="num py-1.5 text-right text-muted">₦{fmtInt(r.count ? r.revenueNgn / r.count : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
