"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";
import type { TxCategory } from "@/lib/domain/types";
import { fmtCompact, fmtInt } from "@/lib/format";
import { CAT_COLOR, CAT_LIST } from "./cats";

type Day = { day: string; label: string; byCat: Record<TxCategory, number>; count: number; failed: number };

/**
 * Daily completed volume, stacked by product. Click a legend chip to hide or
 * show that product (the axis rescales); hover a day for the breakdown.
 */
export function ProductVolumeChart({ data }: { data: Day[] }) {
  const [off, setOff] = useState<Set<TxCategory>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const shown = CAT_LIST.filter((c) => !off.has(c.id));
  const totals = data.map((d) => shown.reduce((s, c) => s + d.byCat[c.id], 0));
  const max = Math.max(...totals, 1);
  const sum30 = totals.reduce((s, n) => s + n, 0);
  const prev = totals.slice(0, 15).reduce((s, n) => s + n, 0), last = totals.slice(15).reduce((s, n) => s + n, 0);
  const trend = prev ? ((last - prev) / prev) * 100 : 0;

  return (
    <figure>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="display num text-[30px] leading-none font-extrabold">${fmtCompact(sum30)}</div>
          <div className="mt-1 text-[12px] text-muted">
            completed · 30 days · <span className={trend >= 0 ? "font-bold text-success-600 dark:text-success-300" : "font-bold text-error-600"}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%</span> last 15d vs prior 15d
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Toggle products">
          {CAT_LIST.map((c) => {
            const on = !off.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setOff((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else if (n.size < CAT_LIST.length - 1) n.add(c.id); return n; })}
                  className={cx("pop inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-bold", on ? "bg-surface" : "bg-sunken text-muted line-through")}
                >
                  <span className="size-2.5 rounded-full" style={{ background: on ? CAT_COLOR[c.id] : "var(--line)" }} aria-hidden />
                  {c.short}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative h-56 pl-12">
        {[1, 0.5, 0].map((t) => (
          <div key={t} className="absolute right-0 left-12 border-t border-dashed border-line" style={{ bottom: `${t * 100}%` }}>
            <span className="num absolute -top-2 -left-12 w-10 text-right text-[10.5px] text-muted">${fmtCompact(max * t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 left-12 flex items-end gap-[3px]" onPointerLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div
              key={d.day}
              tabIndex={0}
              role="img"
              aria-label={`${d.label}: $${fmtInt(totals[i])}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="flex h-full flex-1 cursor-crosshair flex-col justify-end outline-none"
            >
              <div className={cx("flex w-full flex-col-reverse gap-[2px] transition-opacity", hover !== null && hover !== i && "opacity-40")} style={{ height: `${(totals[i] / max) * 100}%` }}>
                {shown.map((c, k) => {
                  const v = d.byCat[c.id];
                  if (!v || !totals[i]) return null;
                  return <div key={c.id} className={cx("w-full", k === shown.length - 1 || shown.slice(k + 1).every((x) => !d.byCat[x.id]) ? "rounded-t-[4px]" : "")} style={{ height: `${(v / totals[i]) * 100}%`, minHeight: 2, background: CAT_COLOR[c.id] }} />;
                })}
              </div>
            </div>
          ))}
        </div>
        {hover !== null && (
          <div role="tooltip" className="pointer-events-none absolute z-10 w-48 -translate-x-1/2 rounded-chip border-2 border-edge bg-surface p-3 text-[12px] shadow-hard-sm" style={{ left: `clamp(110px, calc(48px + (100% - 48px) * ${(hover + 0.5) / data.length}), calc(100% - 100px))`, top: -10 }}>
            <div className="flex justify-between font-bold"><span>{data[hover].label}</span><span className="num">${fmtInt(totals[hover])}</span></div>
            <ul className="mt-1.5 space-y-0.5">
              {shown.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: CAT_COLOR[c.id] }} />{c.short}</span>
                  <span className="num">${fmtInt(data[hover].byCat[c.id])}</span>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 border-t border-line pt-1 text-muted">{fmtInt(data[hover].count)} tx · {fmtInt(data[hover].failed)} failed</div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between pl-12 text-[11px] text-muted">
        <span>{data[0]?.label}</span><span>{data[Math.floor(data.length / 2)]?.label}</span><span>{data[data.length - 1]?.label}</span>
      </div>
    </figure>
  );
}
