import { cx } from "@/components/ui/cx";
import { fmtNgnCompact } from "@/lib/format";

type Book = { id: string; label: string; balance: number; low: number; closes: number[] };

/** Small multiples: each NGN book's 30-day closing balance against its minimum (dashed). */
export function BookTrends({ books }: { books: Book[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {books.map((b) => {
        const W = 200, H = 64;
        const vals = b.closes;
        // Scale to the book's own 30-day range so movement is visible; the minimum
        // line is drawn only when it falls inside that range.
        const vmin = Math.min(...vals), vmax = Math.max(...vals);
        const pad = (vmax - vmin) * 0.12 || Math.abs(vmax) * 0.02 || 1;
        const lo = vmin - pad, hi = vmax + pad;
        const span = hi - lo || 1;
        const minInRange = b.low > 0 && b.low >= lo && b.low <= hi;
        const x = (i: number) => (i / (vals.length - 1)) * W;
        const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 8);
        const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
        const first = vals[0] || 1, last = vals[vals.length - 1];
        const change = ((last - first) / Math.abs(first)) * 100;
        const below = b.low > 0 && last < b.low * 1.5;
        return (
          <li key={b.id} className={cx("rounded-chip border-2 p-3", below ? "border-error-500 bg-error-50/40 dark:bg-error-600/10" : "border-line bg-surface")}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12.5px] font-bold">{b.label}</span>
              <span className={cx("num text-[11px] font-bold", change >= 0 ? "text-success-600 dark:text-success-300" : "text-error-600 dark:text-error-50")}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%</span>
            </div>
            <div className="display num mt-0.5 text-[20px] font-extrabold">{fmtNgnCompact(b.balance)}</div>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-16 w-full" preserveAspectRatio="none" role="img" aria-label={`${b.label} 30-day balance, ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}%`}>
              {minInRange && <line x1="0" x2={W} y1={y(b.low)} y2={y(b.low)} stroke="var(--color-error-500)" strokeDasharray="4 3" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
              <path d={`${line}L${W},${H}L0,${H}Z`} fill="var(--cat-1)" opacity="0.14" />
              <path d={line} fill="none" stroke="var(--cat-1)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="mt-1 flex justify-between text-[10.5px] text-muted">
              <span>30d ago</span>
              {b.low > 0 && <span className={minInRange ? "text-error-600 dark:text-error-50" : ""}>{minInRange ? "- - " : ""}min {fmtNgnCompact(b.low)}{minInRange ? "" : ` · ${Math.round(((last - b.low) / b.low) * 100)}% above`}</span>}
              <span>today</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
