import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { Suspense } from "react";
import { BookTrends } from "@/components/charts/BookTrends";
import { Heatmap } from "@/components/charts/Heatmap";
import { ProductVolumeChart } from "@/components/charts/ProductVolumeChart";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { RevenueMix } from "@/components/charts/RevenueMix";
import { RunwayChart } from "@/components/charts/RunwayChart";
import { SuccessByProduct } from "@/components/charts/SuccessByProduct";
import { TopRoutes } from "@/components/charts/TopRoutes";
import { Route } from "@/components/transactions/Route";
import { Icon } from "@/components/shell/icons";
import { LegsButton } from "@/components/transactions/TxDrawer";
import { StatusPill } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Empty, PageHeader, Panel, Stat } from "@/components/ui/Panel";
import { BrandLoader, CardsSkeleton, PanelSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { getAdmin } from "@/lib/auth/current";
import { getOverview } from "@/lib/data/repo";
import { fmtCompact, fmtDateTime, fmtInt, fmtNgnCompact, fmtPct, fmtTime } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Suspense fallback="gm">{<Greeting />}</Suspense>}
        title="Overview"
        subtitle="What moved, what earned, what broke and which NGN books need naira. Anything with a shadow is clickable."
      />
      <Suspense fallback={<OverviewSkeleton />}>
        <Gate perm="overview.view"><Overview /></Gate>
      </Suspense>
    </>
  );
}

async function Greeting() {
  const admin = await getAdmin();
  return <>gm, {admin.name.split(" ")[0]} ✦</>;
}

function delta(now: number, prev: number) {
  if (!prev) return { text: "no prior data", tone: "flat" as const };
  const d = ((now - prev) / prev) * 100;
  return { text: `${d >= 0 ? "▲" : "▼"} ${fmtPct(Math.abs(d), 1)} vs last week`, tone: d >= 0 ? ("up" as const) : ("down" as const) };
}

const dayLabel = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

async function Overview() {
  const o = await getOverview();
  const vd = delta(o.vol7, o.volPrev7);
  const rd = delta(o.rev7, o.revPrev7);
  const atRisk = o.books.filter((b) => b.topup && b.runwayDays !== null && b.runwayDays < 14).length;

  return (
    <div className="space-y-6">
      <p className="inline-flex flex-wrap items-center gap-2 rounded-full border-2 border-dashed border-line px-3 py-1 text-[12px] text-muted">
        <span className="size-2 animate-pulse rounded-full bg-success-500" aria-hidden />
        Data as of {fmtDateTime(o.asOf)} Lagos · demo dataset, rates illustrative
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat href="/transactions?status=completed" color="purple" label="Volume · 7 days" value={`$${fmtCompact(o.vol7)}`} sub={vd.text} tone={vd.tone} />
        <Stat href="/transactions" color="orange" label="Markup & fees · 7d" value={fmtNgnCompact(o.rev7)} sub={rd.text} tone={rd.tone} />
        <Stat href="/inventory" color="yellow" label="NGN books at risk" value={atRisk} sub={atRisk ? "under 14 days of runway" : "all books healthy"} />
        <Stat href="/customers" color="ink" label="Customers" value={fmtInt(o.customers)} sub={`+${fmtInt(o.signups7)} joined this week`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Panel title="Volume by product" action={<span className="text-[12px] text-muted">USD · 30 days · tap a product to hide it</span>}>
          <ProductVolumeChart data={o.series.map((s) => ({ day: s.day, label: dayLabel(s.day), byCat: s.byCat, count: s.count, failed: s.failed }))} />
        </Panel>
        <Panel title="Liquidity runway" action={<Link href="/inventory" className="link text-[12.5px]">Top up →</Link>}>
          <p className="mb-4 text-[12px] text-muted">Days until each NGN book hits its minimum at this week&apos;s net burn (top-ups excluded).</p>
          <RunwayChart books={o.books} />
        </Panel>
      </div>

      <Panel title="NGN books · 30 days" action={<span className="text-[12px] text-muted">closing balance per day vs minimum</span>}>
        <BookTrends books={o.books.filter((b) => b.topup)} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Markup & fees" action={<span className="text-[12px] text-muted">₦ · 30 days</span>}>
          <RevenueChart data={o.series.map((s) => ({ label: dayLabel(s.day), value: s.revenueNgn }))} />
          <div className="mt-5 border-t-2 border-line pt-4">
            <RevenueMix data={o.rev30ByCat} />
          </div>
        </Panel>
        <div className="grid grid-cols-1 gap-6">
          <Panel title="Success rate by product" action={<span className="text-[12px] text-muted">settled tx · 7 days · worst first</span>}>
            <SuccessByProduct data={o.outcome7} />
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Top routes" action={<span className="text-[12px] text-muted">completed · 7 days</span>}>
          <TopRoutes rows={o.topRoutes7} />
        </Panel>
        <Panel title="When the tribe moves money" action={<span className="text-[12px] text-muted">tx by weekday × hour · 30d</span>}>
          <Heatmap grid={o.heat} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Needs attention" bodyClass="p-3">
          <ul className="space-y-2 text-[13px]">
            <Attention href="/verifications" label="KYC checks to review" value={o.kycPending} hot={o.kycPending > 0} />
            <Attention href="/transactions?status=pending" label="Pending transactions" value={o.pendingAll} hot={o.pendingAll > 50} />
            <Attention href="/transactions?status=failed" label="Failed in last 24h" value={o.statusCount24.failed ?? 0} hot={(o.statusCount24.failed ?? 0) > 0} />
            <Attention href="/inventory" label="NGN books under 14 days of runway" value={atRisk} hot={atRisk > 0} />
            <Attention href="/customers?tickets=open" label="Customers with open tickets" value={o.openTickets} hot={false} />
          </ul>
        </Panel>
        <Panel title="API health · 24h">
          <div className="grid grid-cols-3 gap-3">
            <Mini label="API calls" value={fmtInt(o.api24)} />
            <Mini label="5xx rate" value={fmtPct(o.apiErrRate * 100, 2)} warn={o.apiErrRate > 0.01} />
            <Mini label="p95 latency" value={`${fmtInt(o.p95)}ms`} warn={o.p95 > 1500} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t-2 border-line pt-4">
            <Mini label="Tx · 24h" value={fmtInt(o.tx24)} />
            <Mini label="Failed" value={fmtPct(o.failRate24 * 100, 1)} warn={o.failRate24 > 0.08} />
            <Mini label="Inventory" value={`$${fmtCompact(o.totalInventoryUsd)}`} />
          </div>
          <Link href="/api-trail?status=5xx" className="link mt-4 inline-flex items-center gap-1.5 text-[12.5px]">View server errors <Icon name="arrow" size={13} /></Link>
        </Panel>
      </div>

      <Panel title="Recent failures · 24h" bodyClass="p-0" action={<Link href="/transactions?status=failed" className="link text-[12.5px]">All failures →</Link>}>
        {o.failedRecent.length === 0 ? (
          <Empty title="No failures today" hint="Clean run. Love to see it." />
        ) : (
          <Table>
            <THead>
              <Th>Time</Th><Th>Customer</Th><Th>Transaction · route</Th><Th>Paid with</Th><Th>Reason</Th><Th>Status</Th><Th className="text-right">Legs</Th>
            </THead>
            <tbody>
              {o.failedRecent.map((t) => (
                <Tr key={t.id}>
                  <Td className="num text-muted">{fmtTime(t.createdAt)}</Td>
                  <Td><Link href={`/customers/${t.customerId}`} className="link">{t.customerName}</Link></Td>
                  <Td>
                    <Link href={`/transactions/${t.id}`} className="link font-medium">{t.title}</Link>
                    <div className="mt-1"><Route assets={t.route} size="sm" /></div>
                  </Td>
                  <Td><Money asset={t.source.asset} amount={t.source.amount} icon /></Td>
                  <Td className="max-w-64 truncate text-muted">{t.failureReason}</Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td className="text-right"><LegsButton id={t.id} count={t.legCount} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
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

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`num mt-1 truncate text-[18px] font-extrabold ${warn ? "text-error-600" : ""}`}>{value}</div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="h-7 w-80 rounded-full" />
        <BrandLoader text="Counting the naira…" />
      </div>
      <CardsSkeleton />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <PanelSkeleton><div className="flex h-52 items-end gap-1.5">{Array.from({ length: 30 }, (_, i) => <Skeleton key={i} className="flex-1 rounded-b-none" />)}</div></PanelSkeleton>
        <PanelSkeleton><div className="space-y-4">{Array.from({ length: 5 }, (_, i) => <div key={i}><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-2 h-2.5 w-full rounded-full" /></div>)}</div></PanelSkeleton>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <PanelSkeleton><Skeleton className="h-44 w-full" /></PanelSkeleton>
        <PanelSkeleton><div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1">{Array.from({ length: 168 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-[4px]" />)}</div></PanelSkeleton>
      </div>
    </div>
  );
}
