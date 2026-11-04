"use client";

import { useEffect, useState, useTransition } from "react";
import { TrendChart } from "@/components/charts/TrendChart";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { AssetIcon } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { getRateHistory, pollRates } from "@/lib/actions/admin";
import type { RatePoint, RatesSnapshot } from "@/lib/domain/types";
import { fmtDateTime, fmtPct, fmtRate, fmtTime, signOf, toNum } from "@/lib/format";

const POLL_MS = 10_000;
const RANGES = [{ h: 1, l: "1h" }, { h: 24, l: "24h" }, { h: 72, l: "3d" }, { h: 168, l: "7d" }] as const;

/**
 * Latest provider rates, refreshed every ~10 s through a server action (the
 * token stays on the server), plus the history of the selected asset.
 * Polling pauses while the tab is hidden.
 */
export function LiveRates({ initial }: { initial: RatesSnapshot }) {
  const [snap, setSnap] = useState(initial);
  const [error, setError] = useState(false);
  const [asset, setAsset] = useState(initial.rates.find((r) => r.asset === "BTC")?.asset ?? initial.rates[0]?.asset ?? "USD");
  const [hours, setHours] = useState<number>(24);
  const [history, setHistory] = useState<{ key: string; points: RatePoint[] } | null>(null);
  const [, start] = useTransition();
  const key = `${asset}:${hours}`;

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      pollRates().then((s) => { setSnap(s); setError(false); }, () => setError(true));
    };
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    start(async () => {
      const points = await getRateHistory(asset, hours).catch(() => []);
      if (alive) setHistory({ key, points });
    });
    return () => { alive = false; };
  }, [asset, hours, key]);

  const rows = [...snap.rates].sort((a, b) => a.asset.localeCompare(b.asset));
  const points = history?.key === key ? history.points : null;
  // NGN is priced in USD; everything else in NGN.
  const series = (points ?? []).map((p) => ({ label: fmtTime(p.at), value: toNum(asset === "NGN" ? p.usd : p.ngn) }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="card overflow-hidden" aria-label="Latest rates">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line bg-sunken px-5 py-3 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-2">
            <span className={cx("size-2 rounded-full", error || snap.isStale ? "bg-warning-500" : "animate-pulse bg-success-500")} aria-hidden />
            Collected {fmtDateTime(snap.collectedAt)} · v{snap.version}
          </span>
          <span className="flex items-center gap-2">
            {snap.isStale && <Badge tone="warning">Stale</Badge>}
            {error && <Badge tone="error">Refresh failed</Badge>}
            <span>every {POLL_MS / 1000}s</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr className="border-b-2 border-line"><th className="px-5 py-2.5">Asset</th><th className="px-3 py-2.5 text-right">USD</th><th className="px-3 py-2.5 text-right">NGN</th><th className="px-5 py-2.5 text-right">Today</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = r.asset === asset;
                const s = signOf(r.changePct);
                return (
                  <tr key={r.asset} className={cx("border-b border-line last:border-0", on ? "bg-orange-100 dark:bg-orange-900/40" : "hover:bg-purple-50/60 dark:hover:bg-purple-900/20")}>
                    <td className="px-5 py-2">
                      <button type="button" onClick={() => setAsset(r.asset)} aria-pressed={on} className="inline-flex cursor-pointer items-center gap-2 font-semibold underline-offset-2 hover:underline">
                        <AssetIcon asset={r.asset} size={18} /> {r.asset}
                      </button>
                    </td>
                    <td className="num px-3 py-2 text-right">${fmtRate(r.usd)}</td>
                    <td className="num px-3 py-2 text-right">₦{fmtRate(r.ngn)}</td>
                    <td className={cx("num px-5 py-2 text-right font-semibold", s > 0 ? "text-success-600 dark:text-success-300" : s < 0 ? "text-error-600 dark:text-error-50" : "text-muted")}>{s > 0 ? "+" : ""}{fmtPct(r.changePct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden" aria-label={`${asset} history`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line px-5 py-3">
          <h2 className="display inline-flex items-center gap-2 text-[19px] font-bold uppercase"><AssetIcon asset={asset} size={20} /> {asset} · {asset === "NGN" ? "USD per ₦1" : "₦ per 1"}</h2>
          <div className="inline-flex gap-1 rounded-full border-2 border-edge bg-surface p-1" role="group" aria-label="Range">
            {RANGES.map((r) => (
              <button key={r.h} type="button" aria-pressed={hours === r.h} onClick={() => setHours(r.h)} className={cx("press h-7 cursor-pointer rounded-full px-3 text-[12px] font-semibold", hours === r.h ? "bg-ink-900 text-white dark:bg-orange-500 dark:text-ink-900" : "text-fg/70 hover:bg-orange-100 dark:hover:bg-orange-900/50")}>{r.l}</button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {points === null ? <Skeleton className="h-44 w-full" /> : series.length < 2 ? (
            <p className="py-14 text-center text-[12.5px] text-muted">Not enough history for this range yet.</p>
          ) : (
            <TrendChart data={series} prefix={asset === "NGN" ? "$" : "₦"} noun="" ariaLabel={`${asset} rate`} />
          )}
          {points && points.length > 0 && <p className="mt-2 text-[11.5px] text-muted">{points.length} samples · from {fmtDateTime(points[0].at)}</p>}
        </div>
      </section>
    </div>
  );
}
