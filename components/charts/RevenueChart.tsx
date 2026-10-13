"use client";

import { useRef, useState } from "react";
import { fmtCompact, fmtInt } from "@/lib/format";

/** Daily markup revenue (₦): 2px line + light area, crosshair + tooltip, labelled last point. */
export function RevenueChart({ data }: { data: { label: string; value: number }[] }) {
  const [i, setI] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const W = 600, H = 180, P = 6;
  const max = Math.max(...data.map((d) => d.value), 1);
  const x = (k: number) => P + (k / (data.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const line = data.map((d, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const last = data.length - 1;

  const onMove = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const k = Math.round(((e.clientX - r.left) / r.width) * last);
    setI(Math.min(last, Math.max(0, k)));
  };

  return (
    <figure ref={box} className="relative" onPointerMove={onMove} onPointerLeave={() => setI(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full cursor-crosshair overflow-visible" preserveAspectRatio="none" role="img" aria-label={`Daily markup revenue, last ${data.length} days. Latest ₦${fmtInt(data[last]?.value ?? 0)}.`}>
        {[0.5, 1].map((t) => <line key={t} x1="0" x2={W} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />)}
        <path d={`${line}L${x(last)},${H}L${x(0)},${H}Z`} fill="var(--cat-2)" opacity="0.14" />
        <path d={line} fill="none" stroke="var(--cat-2)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {i !== null && <line x1={x(i)} x2={x(i)} y1="0" y2={H} stroke="var(--fg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* Markers in HTML so they stay round under preserveAspectRatio="none". */}
      <span className="pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-[var(--surface)] bg-[var(--cat-2)]" style={{ left: `${(x(last) / W) * 100}%`, top: `${(y(data[last].value) / H) * 100}%` }} />
      <span className="num pointer-events-none absolute -translate-y-full rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-white dark:bg-white dark:text-ink-900" style={{ right: 0, top: `calc(${(y(data[last].value) / H) * 100}% - 8px)` }}>
        ₦{fmtCompact(data[last].value)} today
      </span>
      {i !== null && (
        <>
          <span className="pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-[var(--surface)] bg-ink-900 dark:bg-white" style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(data[i].value) / H) * 100}%` }} />
          <div role="tooltip" className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-chip border-2 border-edge bg-surface px-3 py-2 text-[12px] shadow-hard-sm" style={{ left: `clamp(70px, ${(x(i) / W) * 100}%, calc(100% - 70px))` }}>
            <div className="font-bold">{data[i].label}</div>
            <div className="num">₦{fmtInt(data[i].value)} revenue</div>
          </div>
        </>
      )}
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[last]?.label}</span>
      </div>
    </figure>
  );
}
