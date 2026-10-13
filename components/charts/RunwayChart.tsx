import { cx } from "@/components/ui/cx";
import { fmtCompact, fmtNgnCompact } from "@/lib/format";

type Book = { id: string; label: string; balance: number; low: number; topup: boolean; burnPerDay: number; net7: number; runwayDays: number | null };

const CAP = 45; // days shown at full width

/**
 * Days until each NGN book hits its minimum at the last 7 days' net burn
 * (top-ups excluded). Red < 7 days, orange < 14, green otherwise; books that
 * grew this week show "Growing".
 */
export function RunwayChart({ books }: { books: Book[] }) {
  const rows = books.filter((b) => b.topup).sort((a, b) => (a.runwayDays ?? Infinity) - (b.runwayDays ?? Infinity));
  return (
    <ul className="space-y-3.5">
      {rows.map((b) => {
        const d = b.runwayDays;
        const tone = d === null ? "grow" : d < 7 ? "red" : d < 14 ? "orange" : "green";
        const color = { grow: "var(--color-success-500)", red: "var(--color-error-500)", orange: "var(--color-orange-500)", green: "var(--color-success-500)" }[tone];
        return (
          <li key={b.id}>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-bold">{b.label}</span>
              <span className={cx("num font-extrabold", tone === "red" && "text-error-600 dark:text-error-50", tone === "orange" && "text-orange-600 dark:text-orange-300")}>
                {d === null ? "Growing ↑" : d >= CAP ? `${CAP}+ days` : `${d.toFixed(d < 10 ? 1 : 0)} days`}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${b.label}: ${d === null ? "growing" : `${Math.round(d)} days of runway`}`}>
              <div className="h-full rounded-full" style={{ width: `${d === null ? 100 : Math.max(3, Math.min(100, (d / CAP) * 100))}%`, background: color, opacity: d === null ? 0.35 : 1 }} />
            </div>
            <div className="num mt-1 flex justify-between gap-2 text-[11px] text-muted">
              <span>{fmtNgnCompact(b.balance)} now · min {fmtNgnCompact(b.low)}</span>
              <span>{b.burnPerDay > 0 ? `burns ₦${fmtCompact(b.burnPerDay)}/day` : `+₦${fmtCompact(b.net7 / 7)}/day`}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
