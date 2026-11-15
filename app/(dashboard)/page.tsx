import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CAT_COLOR } from "@/components/charts/cats";
import { TrendChart } from "@/components/charts/TrendChart";
import { Icon } from "@/components/shell/icons";
import { Route, routeOf } from "@/components/transactions/Route";
import { LegsButton } from "@/components/transactions/TxDrawer";
import { StatusPill } from "@/components/ui/Badge";
import { AssetIcon, Money } from "@/components/ui/Money";
import { Empty, PageHeader, Panel, Stat } from "@/components/ui/Panel";
import { CardsSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { settle } from "@/lib/api/client";
import { getAdmin } from "@/lib/auth/current";
import { getOverviewByCategory, getOverviewFailures, getOverviewSeries, getOverviewStats, getOverviewVaults } from "@/lib/data/repo";
import { categoryLabel } from "@/lib/domain/catalog";
import { fmtCompact, fmtDateTime, fmtInt, fmtPct, fmtTime, toNum } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

// Each panel reads its own endpoint inside its own <Suspense>, so it opens the
// moment its data lands, and a failing read only blanks that panel. The KPI
// tiles and "Needs attention" share one /overview/stats call (repo cache).

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Suspense fallback="gm">{<Greeting />}</Suspense>}
        title="Overview"
        subtitle="What moved, what broke and what needs a human, live from the Tribe API. Anything with a shadow is clickable."
      />
      <Suspense fallback={<Board kpis={<KpisSkeleton />} series={<SeriesSkeleton />} categories={<CategoriesSkeleton />} attention={<AttentionSkeleton />} vaults={<VaultsSkeleton />} failures={<FailuresSkeleton />} />}>
        <Gate perm="overview.view">
          <Board
            kpis={<Suspense fallback={<KpisSkeleton />}><Kpis /></Suspense>}
            series={<Suspense fallback={<SeriesSkeleton />}><Series /></Suspense>}
            categories={<Suspense fallback={<CategoriesSkeleton />}><Categories /></Suspense>}
            attention={<Suspense fallback={<AttentionSkeleton />}><NeedsAttention /></Suspense>}
            vaults={<Suspense fallback={<VaultsSkeleton />}><Vaults /></Suspense>}
            failures={<Suspense fallback={<FailuresSkeleton />}><Failures /></Suspense>}
          />
        </Gate>
      </Suspense>
    </>
  );
}

async function Greeting() {
  const admin = await getAdmin();
  return <>gm, {admin.name.split(" ")[0]} ✦</>;
}

/** The page frame: panel titles render at once, each body is its own slot. */
function Board({ kpis, series, categories, attention, vaults, failures }: Record<"kpis" | "series" | "categories" | "attention" | "vaults" | "failures", ReactNode>) {
  return (
    <div className="space-y-6">
      {kpis}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Panel title="Daily volume" action={<span className="text-[12px] text-muted">USD · completed</span>}>{series}</Panel>
        <Panel title="By product · 7 days">{categories}</Panel>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Needs attention" bodyClass="p-3">{attention}</Panel>
        <Panel title="Provider vaults" action={<Link href="/inventory" className="link text-[12.5px]">Inventory →</Link>} bodyClass="p-0">{vaults}</Panel>
      </div>
      <Panel title="Recent failures" bodyClass="p-0" action={<Link href="/transactions?status=failed" className="link text-[12.5px]">All failures →</Link>}>{failures}</Panel>
    </div>
  );
}

const Failed = ({ message }: { message: string }) => <Empty title="Couldn't load this" hint={message} />;
const dayLabel = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

async function Kpis() {
  const r = await settle(getOverviewStats);
  if (!r.ok) return <div className="card"><Failed message={r.message} /></div>;
  const o = r.data;
  return (
    <>
      <p className="inline-flex flex-wrap items-center gap-2 rounded-full border-2 border-dashed border-line px-3 py-1 text-[12px] text-muted">
        <span className="size-2 animate-pulse rounded-full bg-success-500" aria-hidden />
        Data as of {fmtDateTime(o.asOf)} Lagos · live from the API
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat href="/transactions?status=completed" color="purple" label="Volume · 7 days" value={`$${fmtCompact(o.vol7)}`} sub={`$${fmtCompact(o.vol1)} in the last 24h`} />
        <Stat href="/transactions" color="orange" label="Transactions · 24h" value={fmtInt(o.tx24)} sub={`${fmtInt(o.failed24)} failed · ${fmtPct(o.failRate24 * 100, 1)}`} tone={o.failRate24 > 0.08 ? "down" : "flat"} />
        <Stat href="/verifications" color="yellow" label="KYC to review" value={fmtInt(o.kycPending)} sub={o.kycPending ? "waiting for a decision" : "queue is clear"} />
        <Stat href="/customers" color="ink" label="Customers" value={fmtInt(o.customers)} sub={`+${fmtInt(o.signups7)} joined this week`} />
      </div>
    </>
  );
}

async function Series() {
  const r = await settle(getOverviewSeries);
  if (!r.ok) return <Failed message={r.message} />;
  return r.data.length ? (
    <TrendChart data={r.data.map((s) => ({ label: dayLabel(s.day), value: toNum(s.volumeUsd) }))} prefix="$" noun="volume" ariaLabel="Daily completed volume" />
  ) : (
    <Empty title="No volume yet" />
  );
}

async function Categories() {
  const r = await settle(getOverviewByCategory);
  if (!r.ok) return <Failed message={r.message} />;
  if (r.data.length === 0) return <Empty title="No transactions this week" />;
  const max = Math.max(1, ...r.data.map((c) => toNum(c.volumeUsd)));
  return (
    <ul className="space-y-4">
      {r.data.map((c) => (
        <li key={c.category}>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <Link href={`/transactions?category=${c.category}`} className="link font-semibold">{categoryLabel(c.category)}</Link>
            <span className="num text-muted">{fmtInt(c.count)} tx · <b className="text-fg">${fmtCompact(c.volumeUsd)}</b></span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full" style={{ width: `${Math.max(3, (toNum(c.volumeUsd) / max) * 100)}%`, background: CAT_COLOR[c.category] ?? "var(--cat-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function NeedsAttention() {
  const r = await settle(getOverviewStats);
  if (!r.ok) return <Failed message={r.message} />;
  const o = r.data;
  return (
    <ul className="space-y-2 text-[13px]">
      <Attention href="/verifications" label="Verification requests to review" value={o.kycPending} hot={o.kycPending > 0} />
      <Attention href="/transactions?status=pending" label="Pending transactions" value={o.pendingAll} hot={o.pendingAll > 50} />
      <Attention href="/transactions?status=failed" label="Failed in last 24h" value={o.failed24} hot={o.failed24 > 0} />
      <Attention href="/support?status=open" label="Open support tickets" value={o.openTickets} hot={o.openTickets > 0} />
      <Suspense fallback={<li><Skeleton className="h-11 w-full" /></li>}>
        <EmptyVaults />
      </Suspense>
    </ul>
  );
}

async function EmptyVaults() {
  const r = await settle(getOverviewVaults);
  return r.ok ? <Attention href="/inventory#fundings" label="Provider vaults empty or overdrawn" value={r.data.filter((v) => !/[1-9]/.test(v.balance) || v.balance.startsWith("-")).length} hot={r.data.some((v) => v.balance.startsWith("-"))} /> : null;
}

async function Vaults() {
  const r = await settle(getOverviewVaults);
  if (!r.ok) return <Failed message={r.message} />;
  return r.data.length === 0 ? <Empty title="No vaults" /> : (
    <ul className="grid grid-cols-1 divide-y-2 divide-line sm:grid-cols-2 sm:divide-y-0">
      {r.data.map((v) => (
        <li key={v.id} className="flex items-center justify-between gap-3 border-line px-5 py-2.5 sm:border-b">
          <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
            <AssetIcon asset={v.asset} size={18} />{v.asset}
            <span className="truncate text-[12px] font-normal text-muted">{v.providerName}</span>
          </span>
          <Money asset={v.asset} amount={v.balance} className="font-semibold" />
        </li>
      ))}
    </ul>
  );
}

async function Failures() {
  const r = await settle(getOverviewFailures);
  if (!r.ok) return <Failed message={r.message} />;
  return r.data.length === 0 ? (
    <Empty title="No failures today" hint="Clean run. Love to see it." />
  ) : (
    <Table>
      <THead>
        <Th>Time</Th><Th>Customer</Th><Th>Transaction · route</Th><Th>Paid with</Th><Th>Reason</Th><Th>Status</Th><Th className="text-right">Ledger</Th>
      </THead>
      <tbody>
        {r.data.map((t) => (
          <Tr key={t.id}>
            <Td className="num text-muted">{fmtTime(t.createdAt)}</Td>
            <Td><Link href={`/customers/${t.customerId}`} className="link">{t.customerName ?? `${t.customerId.slice(0, 10)}…`}</Link></Td>
            <Td>
              <Link href={`/transactions/${t.id}`} className="link font-medium">{t.title}</Link>
              <div className="mt-1"><Route assets={routeOf(t)} size="sm" /></div>
            </Td>
            <Td><Money asset={t.source.asset} amount={t.source.amount} icon /></Td>
            <Td className="max-w-64 truncate text-muted">{t.failureReason}</Td>
            <Td><StatusPill status={t.status} /></Td>
            <Td className="text-right"><LegsButton id={t.id} /></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

function Attention({ href, label, value, hot }: { href: string; label: string; value: number; hot: boolean }) {
  return (
    <li>
      <Link href={href} className="pop flex items-center gap-3 rounded-chip bg-surface px-3 py-2.5">
        <span className={`size-2.5 rounded-full ${hot ? "bg-orange-500" : "bg-success-500"}`} aria-hidden />
        <span className="flex-1 font-medium">{label}</span>
        <span className={`num rounded-full px-2 py-0.5 text-[12px] font-extrabold ${hot ? "bg-orange-500 text-ink-900" : "bg-sunken"}`}>{fmtInt(value)}</span>
        <Icon name="arrow" size={14} />
      </Link>
    </li>
  );
}

// ── Skeletons: one per panel body, shaped like what lands there ──────────────
function KpisSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-7 w-80 max-w-full rounded-full" />
      <CardsSkeleton />
    </div>
  );
}

function SeriesSkeleton() {
  return <div className="flex h-44 items-end gap-1.5" aria-busy="true">{Array.from({ length: 30 }, (_, i) => <Skeleton key={i} className="flex-1 rounded-b-none" />)}</div>;
}

function CategoriesSkeleton() {
  return <div className="space-y-4" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <div key={i}><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-2 h-2.5 w-full rounded-full" /></div>)}</div>;
}

function AttentionSkeleton() {
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>;
}

function VaultsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="flex items-center justify-between gap-3 px-5 py-3"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-24" /></div>)}
    </div>
  );
}

function FailuresSkeleton() {
  return (
    <div aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-6 border-b border-line px-5 last:border-0">
          <Skeleton className="h-3.5 w-12" /><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3.5 w-48" /><Skeleton className="ml-auto h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
