"use client";

import { useState } from "react";
import { fmtInt } from "@/lib/format";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hr = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** When the tribe moves money: weekday × hour, one-hue sequential ramp (light → dark purple). */
export function Heatmap({ grid }: { grid: number[][] }) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const max = Math.max(...grid.flat(), 1);
  let peak: [number, number] = [0, 0];
  grid.forEach((row, d) => row.forEach((v, h) => v > grid[peak[0]][peak[1]] && (peak = [d, h])));
  const shown = hover ?? peak;

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <span>
          {hover ? "Hovering" : "Peak vibes"}: <b>{DAYS[shown[0]]} {hr(shown[1])}</b> · <span className="num">{fmtInt(grid[shown[0]][shown[1]])} tx</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          quiet
          {[0.08, 0.3, 0.55, 0.8, 1].map((t) => <span key={t} className="size-3 rounded-[4px]" style={{ background: `color-mix(in oklab, var(--cat-1) ${t * 100}%, var(--sunken))` }} />)}
          busy
        </span>
      </div>
      <div className="overflow-x-auto" onPointerLeave={() => setHover(null)}>
        <div className="grid min-w-[560px] grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[3px]">
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="self-center text-[10.5px] font-semibold text-muted">{DAYS[d]}</span>
              {row.map((v, h) => {
                const isPeak = d === peak[0] && h === peak[1];
                return (
                  <span
                    key={h}
                    tabIndex={0}
                    role="img"
                    aria-label={`${DAYS[d]} ${hr(h)}: ${v} transactions`}
                    onPointerEnter={() => setHover([d, h])}
                    onFocus={() => setHover([d, h])}
                    className="aspect-square cursor-crosshair rounded-[4px] outline-none hover:ring-2 hover:ring-edge focus-visible:ring-2 focus-visible:ring-edge"
                    style={{ background: v ? `color-mix(in oklab, var(--cat-1) ${Math.round(8 + (v / max) * 92)}%, var(--sunken))` : "var(--sunken)", boxShadow: isPeak ? "0 0 0 2px var(--color-orange-500)" : undefined }}
                  />
                );
              })}
            </div>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[9.5px] text-muted">{h % 3 === 0 ? h : ""}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}
