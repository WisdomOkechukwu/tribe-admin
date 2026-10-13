import { fmtInt, fmtPct } from "@/lib/format";
import type { TxCategory, TxStatus } from "@/lib/domain/types";
import { CAT_LIST } from "./cats";

const SEG: { key: TxStatus; label: string; color: string; icon: string }[] = [
  { key: "completed", label: "Completed", color: "var(--color-success-500)", icon: "✓" },
  { key: "pending", label: "Pending", color: "var(--color-warning-500)", icon: "…" },
  { key: "failed", label: "Failed", color: "var(--color-error-500)", icon: "!" },
  { key: "reversed", label: "Reversed", color: "var(--color-orange-500)", icon: "↺" },
  { key: "cancelled", label: "Cancelled", color: "var(--color-ink-200)", icon: "×" },
];

/** 100% bars per product, worst success rate first: shows where things break. */
export function SuccessByProduct({ data }: { data: Record<TxCategory, Record<TxStatus, number>> }) {
  const rows = CAT_LIST.map((c) => {
    const o = data[c.id];
    const total = SEG.reduce((s, x) => s + (o[x.key] ?? 0), 0);
    // Success over SETTLED transactions: pending (e.g. open cashpoint codes) and
    // customer cancellations aren't failures.
    const settled = (o.completed ?? 0) + (o.failed ?? 0) + (o.reversed ?? 0);
    return { ...c, o, total, settled, rate: settled ? (o.completed ?? 0) / settled : 1 };
  }).sort((a, b) => a.rate - b.rate);
  return (
    <div>
      <ul className="space-y-3.5">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="font-bold">{r.label}</span>
              <span className="num"><b className={r.rate < 0.9 ? "text-error-600 dark:text-error-50" : ""}>{fmtPct(r.rate * 100, 1)}</b> <span className="text-muted">of {fmtInt(r.settled)} settled{r.o.pending ? ` · ${fmtInt(r.o.pending)} pending` : ""}</span></span>
            </div>
            <div className="mt-1.5 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${r.label}: ${SEG.map((s) => `${r.o[s.key] ?? 0} ${s.label.toLowerCase()}`).join(", ")}`}>
              {SEG.map((s) => (r.o[s.key] ? <div key={s.key} title={`${s.label}: ${r.o[s.key]}`} style={{ width: `${(r.o[s.key] / r.total) * 100}%`, background: s.color }} /> : null))}
            </div>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t-2 border-line pt-3 text-[11px]">
        {SEG.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1">
            <span className="grid size-3.5 place-items-center rounded-full text-[8px] font-extrabold text-ink-900" style={{ background: s.color }} aria-hidden>{s.icon}</span>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
