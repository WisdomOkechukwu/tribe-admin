import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { PricingEditor } from "@/components/markups/MarkupModal";
import { ReferralShareForm } from "@/components/markups/ReferralShareForm";
import { LiveRates } from "@/components/rates/LiveRates";
import { Empty, PageHeader } from "@/components/ui/Panel";
import { PanelSkeleton, Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { getReferralSettings, listFees, listMargins, listRates } from "@/lib/data/repo";

export const metadata: Metadata = { title: "Rates & pricing" };

export default function RatesPage() {
  return (
    <>
      <PageHeader
        eyebrow="live"
        title="Rates & pricing"
        subtitle="Provider rates collected by the scheduler (refreshed here every ~10 seconds), the history per asset, and the margins and fees applied on top of them."
      />
      <Suspense fallback={<div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><TableSkeleton rows={8} text="Fetching rates…" /><PanelSkeleton><Skeleton className="h-44 w-full" /></PanelSkeleton></div>}>
        <Gate perm="currencies.view"><Rates /></Gate>
      </Suspense>
      <h2 className="display mt-10 mb-4 text-[28px] font-extrabold uppercase">Margins & fees</h2>
      <Suspense fallback={<TableSkeleton rows={10} text="Loading pricing…" />}>
        <Gate perm="markups.view" compact><Pricing /></Gate>
      </Suspense>
      <h2 className="display mt-10 mb-1 text-[28px] font-extrabold uppercase">Referral share</h2>
      <p className="mb-4 text-[13px] text-muted">What inviters earn: a percentage of Tribe&apos;s earnings on their friends&apos; transactions, paid from Tribe Funds.</p>
      <Suspense fallback={<Skeleton className="h-48 max-w-2xl" />}>
        <Gate perm="markups.view" compact><Referral /></Gate>
      </Suspense>
    </>
  );
}

async function Rates() {
  return <LiveRates initial={await listRates()} />;
}

async function Referral() {
  const [settings, access] = await Promise.all([getReferralSettings(), getAccess()]);
  if (!settings) return <div className="card max-w-2xl"><Empty title="Not available yet" hint="This backend doesn't serve GET /admin-api/referral-settings yet." /></div>;
  return <div className="max-w-2xl"><ReferralShareForm settings={settings} canEdit={access.has("markups.edit")} /></div>;
}

async function Pricing() {
  const [margins, fees, access] = await Promise.all([listMargins(), listFees(), getAccess()]);
  return <PricingEditor inline margins={margins} fees={fees} canEdit={access.has("markups.edit")} />;
}
