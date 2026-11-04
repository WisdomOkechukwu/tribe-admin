import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/shell/icons";
import { JournalEntries, SwapRoute } from "@/components/transactions/LegTimeline";
import { Route, routeOf } from "@/components/transactions/Route";
import { txDetail } from "@/components/transactions/TxTable";
import { Badge, KycBadge, StatusPill } from "@/components/ui/Badge";
import { AssetIcon, Money } from "@/components/ui/Money";
import { Facts, Panel } from "@/components/ui/Panel";
import { BrandLoader, PanelSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { getTransaction, listProviders } from "@/lib/data/repo";
import { assetInfo, categoryLabel, typeLabel } from "@/lib/domain/catalog";
import type { SwapLeg } from "@/lib/domain/types";
import { fmtDateTime, fmtMoney, fmtUsd } from "@/lib/format";

export default function TransactionPage({ params }: PageProps<"/transactions/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Gate perm="transactions.view"><Detail params={params} /></Gate>
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/transactions/[id]">, "params">) {
  const { id } = await params;
  const [data, access] = await Promise.all([getTransaction(decodeURIComponent(id)), getAccess()]);
  if (!data) notFound();
  const { tx, customer, journal, swapLegs } = data;
  const detail = txDetail(tx);
  const paid = tx.source;
  const legCount = journal.reduce((n, j) => n + j.legs.length, 0);
  const meta = Object.entries(tx.meta).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
        <Link href="/transactions" className="link text-fg">Transactions</Link> <span aria-hidden>/</span>
        <Link href={`/transactions?category=${tx.category}`} className="link text-fg">{categoryLabel(tx.category)}</Link> <span aria-hidden>/</span>
        <span>{tx.reference}</span>
      </nav>

      <header className="card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">{typeLabel(tx.type)}</Badge>
              <StatusPill status={tx.status} />
              <span className="font-mono text-[12px] text-muted">{tx.reference} · {tx.id}</span>
            </div>
            <h1 className="display mt-3 text-[36px] font-extrabold uppercase sm:text-[46px]">{tx.title}</h1>
            <div className="mt-3"><Route assets={routeOf(tx, swapLegs)} /></div>
            {detail && <p className="mt-3 text-[13px] text-muted">{detail}</p>}
            {tx.failureReason && <p className="mt-3 rounded-chip bg-error-50 px-3 py-2 text-[12.5px] font-medium text-error-600 dark:bg-error-600/20 dark:text-error-50">{tx.failureReason}</p>}
          </div>
          {/* "Paid with" block, in the currency's own look. */}
          <div className="flex flex-col justify-between gap-4 border-t-2 border-edge bg-purple-500 p-5 text-white sm:p-6 lg:border-t-0 lg:border-l-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{tx.direction === "in" ? "Received in" : "Paid with"}</div>
              <div className="mt-2 flex items-center gap-2.5">
                <AssetIcon asset={paid.asset} size={38} />
                <div>
                  <div className="display text-[24px] leading-none font-extrabold uppercase">{assetInfo(paid.asset).name}</div>
                  <div className="mt-0.5 text-[12px] opacity-80">{paid.asset} · {assetInfo(paid.asset).symbol} · {assetInfo(paid.asset).kind}</div>
                </div>
              </div>
              <div className="display num mt-4 text-[36px] leading-none font-extrabold">{fmtMoney(paid.asset, paid.amount)}</div>
              {tx.destination && tx.destination.asset !== paid.asset && <div className="num mt-1 text-[13px] opacity-90">→ {fmtMoney(tx.destination.asset, tx.destination.amount)} delivered</div>}
            </div>
            <div className="text-[12px] opacity-80">≈ {fmtUsd(tx.usdValue)} · {fmtDateTime(tx.createdAt)}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Panel title={`Journal · ${legCount} legs`} action={<span className="hidden text-[12px] text-muted sm:inline">Double-entry: every entry&apos;s debits equal its credits</span>}>
            <JournalEntries journal={journal} />
          </Panel>
          {swapLegs.length > 0 && (
            <Panel title={`Conversion route · ${swapLegs.length} ${swapLegs.length === 1 ? "hop" : "hops"}`} action={<span className="hidden text-[12px] text-muted sm:inline">Rates applied per hop, from swap_legs</span>}>
              {access.has("providers.view") ? (
                <Suspense fallback={<SwapRoute legs={swapLegs} />}><SwapRouteWithProviders legs={swapLegs} /></Suspense>
              ) : <SwapRoute legs={swapLegs} />}
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Customer">
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="pop group flex items-center gap-3 rounded-chip bg-surface p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{customer.firstName} {customer.lastName}</span>
                  <span className="block truncate text-[12.5px] text-muted">@{customer.tag} · {customer.email}</span>
                  <span className="mt-1.5 flex gap-2"><KycBadge tier={customer.kycTier} status={customer.kycStatus} /><StatusPill status={customer.status} /></span>
                </span>
                <Icon name="arrow" size={16} />
              </Link>
            ) : "—"}
          </Panel>
          <Panel title="Money breakdown">
            <Facts
              cols={1}
              items={[
                [tx.direction === "in" ? "Received in" : "Paid with", <Money key="s" asset={tx.source.asset} amount={tx.source.amount} icon />],
                ["Delivered", tx.destination ? <Money key="d" asset={tx.destination.asset} amount={tx.destination.amount} icon /> : "—"],
                ["Fee charged", tx.fee && /[1-9]/.test(tx.fee.amount) ? <Money key="f" asset={tx.fee.asset} amount={tx.fee.amount} icon /> : "None"],
                ["Value", `≈ ${fmtUsd(tx.usdValue)}`],
                ["Created", fmtDateTime(tx.createdAt)],
                ["Completed", tx.completedAt ? fmtDateTime(tx.completedAt) : "—"],
                ...(tx.quoteId ? [["Quote", <span key="q" className="font-mono text-[12px]">{tx.quoteId}</span>] as [string, React.ReactNode]] : []),
              ]}
            />
          </Panel>
          {meta.length > 0 && (
            <Panel title="Details">
              <Facts cols={1} items={meta.map(([k, v]) => [k.replace(/_/g, " "), <span key={k} className="font-mono text-[12.5px] break-all">{String(v)}</span>])} />
            </Panel>
          )}
          {access.has("api.view") && (
            <Link href={`/api-trail?customer=${encodeURIComponent(tx.customerId)}`} className="link inline-flex items-center gap-1.5 text-[12.5px]">This customer&apos;s API requests <Icon name="arrow" size={13} /></Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Provider names stream in after the route itself (one /providers read). */
async function SwapRouteWithProviders({ legs }: { legs: SwapLeg[] }) {
  const providers = await listProviders().catch(() => []);
  return <SwapRoute legs={legs} providers={Object.fromEntries(providers.map((p) => [p.id, p.name]))} />;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <PanelSkeleton title={false}><div className="flex items-center justify-between"><div className="space-y-3"><Skeleton className="h-5 w-40 rounded-full" /><Skeleton className="h-10 w-72" /><Skeleton className="h-7 w-56 rounded-full" /></div><BrandLoader text="Tracing the legs…" /></div></PanelSkeleton>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
        <PanelSkeleton><div className="space-y-6">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-16 w-full" /></div></div>)}</div></PanelSkeleton>
        <PanelSkeleton />
      </div>
    </div>
  );
}
