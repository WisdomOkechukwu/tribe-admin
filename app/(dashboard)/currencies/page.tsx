import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/shell/icons";
import { AssetIcon } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { listCurrencies } from "@/lib/data/repo";
import { ASSET_FACE, NETWORKS } from "@/lib/domain/catalog";
import { fmtAmount, fmtCompact, fmtInt, fmtRate } from "@/lib/format";

export const metadata: Metadata = { title: "Currencies" };

export default function CurrenciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="the lineup"
        title="Currencies"
        subtitle="Every fiat and crypto Tribe holds: how it looks in the app, its rate, who holds it and how much provider liquidity backs it. Tap a card to see its transactions."
      />
      <Suspense fallback={<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72 rounded-card" />)}</div>}>
        <Gate perm="currencies.view"><Grid /></Gate>
      </Suspense>
    </>
  );
}

async function Grid() {
  const all = await listCurrencies();
  const groups = [
    { title: "Fiat", rows: all.filter((a) => a.kind === "fiat") },
    { title: "Crypto", rows: all.filter((a) => a.kind === "crypto") },
  ];
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="display mb-3 text-[24px] font-extrabold uppercase">{g.title} <span className="text-muted">· {g.rows.length}</span></h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {g.rows.map((a) => {
              const face = ASSET_FACE[a.code];
              const coverOk = a.cover === null || a.cover >= 1;
              return (
                <Link key={a.code} href={`/transactions?asset=${a.code}`} className="pop group block overflow-hidden rounded-card bg-surface">
                  {/* Wallet-card face, in the currency's brand colour. */}
                  <div className="relative overflow-hidden border-b-2 border-edge p-5" style={{ background: face.bg, color: face.fg }}>
                    <span className="display pointer-events-none absolute -top-6 -right-2 text-[130px] leading-none font-extrabold opacity-20 select-none" aria-hidden>{a.symbol}</span>
                    <div className="relative flex items-center gap-3">
                      <AssetIcon asset={a.code} size={44} />
                      <div>
                        <div className="display text-[26px] leading-none font-extrabold uppercase">{a.name}</div>
                        <div className="mt-1 text-[12px] font-semibold opacity-85">{a.code} · {a.symbol} · {a.decimals} dp</div>
                      </div>
                    </div>
                    <div className="relative mt-5 text-[11px] font-bold uppercase tracking-wider opacity-80">Rate</div>
                    <div className="display num relative text-[24px] font-extrabold">
                      {a.code === "NGN" ? `$1 = ₦${fmtRate(1 / a.usd)}` : `1 ${a.code} = ₦${a.ngnRate >= 1_000_000 ? fmtCompact(a.ngnRate) : fmtRate(a.ngnRate)}`}
                    </div>
                    {NETWORKS[a.code] && <div className="relative mt-2 flex flex-wrap gap-1">{NETWORKS[a.code]!.map((n) => <span key={n} className="rounded-full bg-black/20 px-2 py-0.5 text-[10.5px] font-bold uppercase">{n}</span>)}</div>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-[12.5px]">
                    <div><dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Holders</dt><dd className="num mt-0.5 text-[16px] font-extrabold">{fmtInt(a.holders)}</dd></div>
                    <div><dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">7d volume</dt><dd className="num mt-0.5 text-[16px] font-extrabold">${fmtCompact(a.vol7Usd)}</dd></div>
                    <div><dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Customers hold</dt><dd className="num mt-0.5 font-semibold">{a.symbol} {fmtCompact(a.held)}</dd></div>
                    <div><dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Provider liquidity</dt><dd className="num mt-0.5 font-semibold">{a.symbol} {fmtCompact(a.liquidity)}</dd></div>
                    <div className="col-span-2">
                      <dt className="flex justify-between text-[10.5px] font-bold uppercase tracking-wider text-muted">
                        <span>Liquidity cover</span>
                        <span className={coverOk ? "text-success-600" : "text-error-600"}>{a.cover === null ? "n/a" : `${a.cover >= 100 ? "100+" : a.cover.toFixed(1)}×`}</span>
                      </dt>
                      <dd className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken">
                        <div className={`h-full rounded-full ${coverOk ? "bg-success-500" : "bg-error-500"}`} style={{ width: `${a.cover === null ? 0 : Math.min(100, a.cover * 50)}%` }} />
                      </dd>
                      <span className="sr-only">{a.cover === null ? "No customer balances" : `Provider liquidity covers ${fmtAmount(a.code, a.cover)} times customer balances`}</span>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between border-t-2 border-line px-5 py-3 text-[12.5px] font-bold">
                    <span>{fmtInt(a.tx7)} transactions this week</span>
                    <span className="inline-flex items-center gap-1 transition-transform group-hover:translate-x-1">View <Icon name="arrow" size={14} /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
