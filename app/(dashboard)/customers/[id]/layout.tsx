import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ComponentProps } from "react";
import { AdjustmentButton } from "@/components/customers/AdjustmentButton";
import { FreezeButton, LabelEditor } from "@/components/customers/CustomerActions";
import { Avatar } from "@/components/customers/CustomerTable";
import { CustomerTabs } from "@/components/customers/CustomerTabs";
import { KycBadge, StatusPill } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Gate } from "@/components/access/Gate";
import { getAccess } from "@/lib/auth/current";
import { getCustomer, listFreeFunds } from "@/lib/data/repo";
import { CUSTOMER_LABELS } from "@/lib/domain/catalog";
import { fmtAgo, fmtDate, fmtInt, fullName } from "@/lib/format";

export default function CustomerLayout({ children, params }: LayoutProps<"/customers/[id]">) {
  return (
    <>
      <div className="mb-4 text-[12.5px] text-muted">
        <Link href="/customers" className="link text-fg">Customers</Link> <span aria-hidden>/</span> Profile
      </div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Gate perm="customers.view"><Header params={params} /></Gate>
      </Suspense>
      <Suspense fallback={<div className="mb-6 h-[48px] w-[420px] max-w-full rounded-full border-2 border-line" />}>
        <CustomerTabs />
      </Suspense>
      {children}
    </>
  );
}

async function Header({ params }: Pick<LayoutProps<"/customers/[id]">, "params">) {
  const { id } = await params;
  const [c, access] = await Promise.all([getCustomer(id), getAccess()]);
  if (!c) notFound();
  const canAdjust = access.has("adjustments.request") && c.status !== "closed";
  const wallets = c.balances.filter((b) => b.account === "user_primary").map((b) => ({ asset: b.asset as string, balance: b.balance }));
  const now = c.fetchedAt;
  return (
    <header className="card mb-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar c={c} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display text-[34px] font-extrabold uppercase">{fullName(c)}</h1>
            <KycBadge tier={c.kycTier} status={c.kycStatus} />
            <StatusPill status={c.status} />
          </div>
          <p className="mt-1 text-[13px] text-muted">
            @{c.tag} · {c.email}{c.phone ? <> · <span className="num">{c.phone}</span></> : null}
          </p>
          <div className="mt-2.5">
            <LabelEditor id={c.id} labels={c.labels} options={CUSTOMER_LABELS} canEdit={access.has("customers.labels")} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAdjust && (
            <Suspense fallback={<Skeleton className="h-9 w-36 rounded-full" />}>
              <Adjust customerId={c.id} name={c.firstName} wallets={wallets} withFunds={access.has("inventory.view")} />
            </Suspense>
          )}
          {access.has("customers.freeze") && <FreezeButton id={c.id} status={c.status} name={c.firstName} version={c.version} />}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi k="Wallets" v={fmtInt(c.balances.length)} />
        <Kpi k="Transactions" v={fmtInt(c.txCount)} />
        <Kpi k="Cards" v={fmtInt(c.cards.length)} />
        <Kpi k="Country" v={c.country || "—"} />
        <Kpi k="Joined" v={fmtDate(c.createdAt)} />
        <Kpi k="Last active" v={c.lastActiveAt ? fmtAgo(c.lastActiveAt, now) : "Never"} />
      </dl>
    </header>
  );
}

/** The credit / debit button streams in on its own: its credit limit is the currency's Tribe Funds (needs inventory.view). */
async function Adjust({ withFunds, ...props }: Omit<ComponentProps<typeof AdjustmentButton>, "freeFunds"> & { withFunds: boolean }) {
  const freeFunds = withFunds ? await listFreeFunds().catch(() => null) : null;
  return <AdjustmentButton {...props} freeFunds={freeFunds} />;
}

function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-muted">{k}</dt>
      <dd className="num mt-0.5 truncate font-semibold">{v}</dd>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="mb-5 card overflow-hidden p-5">
      <div className="flex gap-4">
        <Skeleton className="size-13 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <Skeleton className="mt-5 h-10 w-full" />
    </div>
  );
}
