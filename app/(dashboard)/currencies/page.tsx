import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { Suspense } from "react";
import { AddCurrencyForm } from "@/components/currencies/AddCurrencyForm";
import { CurrencySwitch } from "@/components/currencies/CurrencySwitch";
import { Icon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/Badge";
import { AssetIcon } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { listCurrencies, listInventory, listProviders } from "@/lib/data/repo";
import { NETWORKS, assetFace, assetInfo } from "@/lib/domain/catalog";
import { addDecimal } from "@/lib/domain/money";
import type { AssetCode } from "@/lib/domain/types";
import { fmtCompact, fmtDateTime, fmtMoney, fmtPct, fmtRate, signOf, toNum } from "@/lib/format";

export const metadata: Metadata = { title: "Currencies" };

export default function CurrenciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="the lineup"
        title="Currencies"
        subtitle="Every fiat and crypto asset the backend supports: how it looks in the app, its live rate, which provider converts it and what the providers hold of it. Tap a card to see its transactions."
        actions={<Link href="/rates" className="link text-[12.5px]">Live rates & margins →</Link>}
      />
      <Suspense fallback={<CurrenciesSkeleton />}>
        <Gate perm="currencies.view"><Grid /></Gate>
      </Suspense>
    </>
  );
}

/** Streams into each card: what every provider holds in this currency, from one /inventory call shared by every card (repo cache). */
async function VaultBalance({ code }: { code: AssetCode }) {
  const access = await getAccess();
  if (!access.has("inventory.view")) return <span className="text-muted">Needs “See inventory”</span>;
  const vaults = (await listInventory().catch(() => [])).filter((v) => v.code === "provider_vault" && v.asset === code);
  if (!vaults.length) return <span className="text-muted">—</span>;
  const total = vaults.reduce((sum, v) => addDecimal(sum, v.balance, assetInfo(code).decimals), "0");
  return <>{fmtMoney(code, total)}</>;
}

/** Streams into each card: one /providers call shared by every card (repo cache). */
async function ProviderLine({ id }: { id: string }) {
  const access = await getAccess();
  const p = access.has("providers.view") ? (await listProviders().catch(() => [])).find((x) => x.id === id) : undefined;
  return (
    <>
      <dd className="text-muted">{p?.name ?? "Provider hidden"}</dd>
      {p?.isSimulator && <Badge tone="warning">Simulated</Badge>}
    </>
  );
}

function CurrenciesSkeleton() {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72 rounded-card" />)}</div>;
}

/** Only for admins who may add currencies: the form, with the providers a currency can be converted by. */
async function AddCurrency() {
  const access = await getAccess();
  if (!access.has("currencies.manage")) return null;
  const providers = access.has("providers.view") ? (await listProviders().catch(() => [])).filter((p) => p.assets.length > 0) : [];
  if (!providers.length) return <p className="text-[12.5px] text-muted">Adding a currency needs “See providers” too, to choose who converts it.</p>;
  return <AddCurrencyForm providers={providers.map((p) => ({ id: p.id, name: p.name }))} />;
}

async function Grid() {
  const [{ rows, collectedAt, isStale }, access] = await Promise.all([listCurrencies(), getAccess()]);
  const canManage = access.has("currencies.manage");
  const groups = [
    { title: "Fiat", rows: rows.filter((a) => a.kind === "fiat") },
    { title: "Crypto", rows: rows.filter((a) => a.kind === "crypto") },
  ];
  return (
    <div className="space-y-8">
      <p className="inline-flex flex-wrap items-center gap-2 rounded-full border-2 border-dashed border-line px-3 py-1 text-[12px] text-muted">
        <span className={`size-2 rounded-full ${isStale ? "bg-warning-500" : "animate-pulse bg-success-500"}`} aria-hidden />
        {collectedAt ? `Rates collected ${fmtDateTime(collectedAt)} Lagos${isStale ? " · stale" : ""}` : "No rates collected yet"}
      </p>
      <AddCurrency />
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="display mb-3 text-[24px] font-extrabold uppercase">{g.title} <span className="text-muted">· {g.rows.length}</span></h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {g.rows.map((a) => {
              const face = assetFace(a.code);
              const ngn = toNum(a.ngn);
              const change = a.changePct ?? "0";
              return (
                <div key={a.code} className={`pop group overflow-hidden rounded-card bg-surface ${a.enabled ? "" : "opacity-80"}`}>
                <Link href={`/transactions?asset=${a.code}`} className="block">
                  {/* Wallet-card face, in the currency's brand colour. */}
                  <div className="relative overflow-hidden border-b-2 border-edge p-5" style={{ background: face.bg, color: face.fg }}>
                    <span className="display pointer-events-none absolute -top-6 -right-2 text-[130px] leading-none font-extrabold opacity-20 select-none" aria-hidden>{a.symbol}</span>
                    <div className="relative flex items-center gap-3">
                      <AssetIcon asset={a.code} size={44} />
                      <div>
                        <div className="display text-[26px] leading-none font-extrabold uppercase">{a.name}</div>
                        <div className="mt-1 text-[12px] font-semibold opacity-85">{a.code} · {a.symbol} · {a.decimals} dp{a.enabled ? "" : " · disabled"}</div>
                      </div>
                    </div>
                    <div className="relative mt-5 text-[11px] font-bold uppercase tracking-wider opacity-80">Rate</div>
                    <div className="display num relative text-[24px] font-extrabold">
                      {a.ngn === null ? "—" : a.code === "NGN" ? `$1 = ₦${fmtRate(1 / toNum(a.usd))}` : `1 ${a.code} = ₦${ngn >= 1_000_000 ? fmtCompact(ngn) : fmtRate(ngn)}`}
                    </div>
                    {NETWORKS[a.code as AssetCode] && <div className="relative mt-2 flex flex-wrap gap-1">{NETWORKS[a.code as AssetCode]!.map((n) => <span key={n} className="rounded-full bg-black/20 px-2 py-0.5 text-[10.5px] font-bold uppercase">{n}</span>)}</div>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-[12.5px]">
                    <div><dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">USD price</dt><dd className="num mt-0.5 text-[16px] font-extrabold">{a.usd === null ? "—" : `$${fmtRate(a.usd)}`}</dd></div>
                    <div>
                      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Today</dt>
                      <dd className={`num mt-0.5 text-[16px] font-extrabold ${signOf(change) > 0 ? "text-success-600 dark:text-success-300" : signOf(change) < 0 ? "text-error-600 dark:text-error-50" : ""}`}>{signOf(change) > 0 ? "+" : ""}{fmtPct(change)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Held by providers</dt>
                      <dd className="num mt-0.5 font-semibold"><Suspense fallback={<Skeleton className="mt-1 h-4 w-28" />}><VaultBalance code={a.code} /></Suspense></dd>
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center gap-2">
                      <dt className="sr-only">Provider</dt>
                      <Suspense fallback={<dd><Skeleton className="h-4 w-32" /></dd>}><ProviderLine id={a.providerId} /></Suspense>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between border-t-2 border-line px-5 py-3 text-[12.5px] font-bold">
                    <span>{a.code} transactions</span>
                    <span className="inline-flex items-center gap-1 transition-transform group-hover:translate-x-1">View <Icon name="arrow" size={14} /></span>
                  </div>
                </Link>
                  {/* the card above is one link, so the switch lives under it */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line px-5 py-3">
                    <CurrencySwitch code={a.code} name={a.name} enabled={a.enabled} version={a.version} canManage={canManage} />
                    {!a.enabled && <Badge tone="error">Off</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
