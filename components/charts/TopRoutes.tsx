import { Route } from "@/components/transactions/Route";
import type { RouteStep } from "@/lib/domain/catalog";
import { fmtCompact, fmtInt, fmtNgnCompact } from "@/lib/format";

/** The corridors money actually takes, ranked by completed volume (7d). */
export function TopRoutes({ rows }: { rows: { steps: RouteStep[]; count: number; volumeUsd: number; revenueNgn: number }[] }) {
  const max = Math.max(...rows.map((r) => r.volumeUsd), 1);
  return (
    <ol className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-3">
          <span className="grid size-5.5 place-items-center rounded-full border-2 border-edge text-[10.5px] font-extrabold">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Route assets={r.steps} size="sm" />
              <span className="num text-[12.5px] font-extrabold">${fmtCompact(r.volumeUsd)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-[var(--cat-1)]" style={{ width: `${Math.max(3, (r.volumeUsd / max) * 100)}%` }} />
            </div>
            <div className="num mt-1 text-[11px] text-muted">{fmtInt(r.count)} tx · {fmtNgnCompact(r.revenueNgn)} kept</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
