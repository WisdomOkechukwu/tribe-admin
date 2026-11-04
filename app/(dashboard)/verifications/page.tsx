import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { VerificationQueue } from "@/components/kyc/VerificationQueue";
import { PageHeader } from "@/components/ui/Panel";
import { TableSkeleton, TabsSkeleton } from "@/components/ui/Skeleton";
import { loadVerifications } from "@/lib/actions/sections";
import { settle } from "@/lib/api/client";
import { getAccess } from "@/lib/auth/current";
import { countVerifications } from "@/lib/data/repo";
import { str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Verifications" };

export default function VerificationsPage({ searchParams }: PageProps<"/verifications">) {
  return (
    <>
      <PageHeader title="Verifications" subtitle="One request per tier, holding all its checks. Approve or reject the whole request; a customer can only have one open at a time." />
      <Suspense fallback={<div className="space-y-4"><TabsSkeleton /><TableSkeleton rows={12} /></div>}>
        <Gate perm="kyc.view">
          <Queue searchParams={searchParams} />
        </Gate>
      </Suspense>
    </>
  );
}

/** Starts both reads without waiting: the tabs render at once, the table and the counts stream in on their own. */
async function Queue({ searchParams }: Pick<PageProps<"/verifications">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const params = { status: str(sp, "status"), page: str(sp, "page") };
  const initial = loadVerifications(params);
  const counts = settle(countVerifications);
  const access = await getAccess();
  return <VerificationQueue initial={initial} initialParams={params} counts={counts} canDecide={access.has("kyc.decide")} canMedia={access.has("kyc.media")} />;
}
