import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { PricingEditor } from "@/components/markups/MarkupModal";
import { LiveRates } from "@/components/rates/LiveRates";
import { PageHeader } from "@/components/ui/Panel";
import { PanelSkeleton, Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { listFees, listMargins, listRates } from "@/lib/data/repo";

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
    </>
  );
}

async function Rates() {
  return <LiveRates initial={await listRates()} />;
}

async function Pricing() {
  const [margins, fees, access] = await Promise.all([listMargins(), listFees(), getAccess()]);
  return <PricingEditor inline margins={margins} fees={fees} canEdit={access.has("markups.edit")} />;
}
