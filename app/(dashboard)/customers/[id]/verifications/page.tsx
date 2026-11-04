import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { KycDecision } from "@/components/kyc/KycDecision";
import { EvidencePlaceholder } from "@/components/kyc/EvidencePlaceholder";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Empty, Panel } from "@/components/ui/Panel";
import { BrandLoader, PanelSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { getCustomerVerifications } from "@/lib/data/repo";
import { TIER_LIMITS, checkLabel, kycTierTitle } from "@/lib/domain/catalog";
import type { VerificationSubmission } from "@/lib/domain/types";
import { fmtDateTime } from "@/lib/format";

export default function VerificationsTab({ params }: PageProps<"/customers/[id]/verifications">) {
  return (
    <Suspense fallback={<div className="space-y-6"><PanelSkeleton><BrandLoader text="Loading checks…" /></PanelSkeleton><PanelSkeleton /></div>}>
      <Gate perm="kyc.view"><Requests params={params} /></Gate>
    </Suspense>
  );
}

/** A tier's badge comes from its LATEST request, so a rejected try followed by an approved one reads Passed. */
function TierBadge({ latest }: { latest: VerificationSubmission }) {
  if (latest.status === "approved") return <Badge tone="success">Passed</Badge>;
  if (latest.status === "rejected") return <Badge tone="error">Rejected</Badge>;
  return <Badge tone="warning">In review</Badge>;
}

async function Requests({ params }: Pick<PageProps<"/customers/[id]/verifications">, "params">) {
  const { id } = await params;
  const [requests, access] = await Promise.all([getCustomerVerifications(id), getAccess()]);
  const canDecide = access.has("kyc.decide");
  const canMedia = access.has("kyc.media");
  if (!requests.length) return <div className="card overflow-hidden"><Empty title="No verification requests yet" hint="Tier 0: the customer hasn't started verification." /></div>;

  // requests arrive newest first; group by tier, highest tier on top
  const tiers = [...new Set(requests.map((r) => r.tier))].sort((a, b) => b - a);
  return (
    <ol className="space-y-6">
      {tiers.map((tier) => {
        const timeline = requests.filter((r) => r.tier === tier);
        return (
          <li key={tier}>
            <Panel
              title={<span className="flex items-center gap-2">{kycTierTitle(tier)} <TierBadge latest={timeline[0]} /></span>}
              action={TIER_LIMITS[tier] ? <span className="text-[12px] text-muted">Unlocks {TIER_LIMITS[tier].daily}/day</span> : undefined}
              bodyClass="px-5 py-5"
            >
              <ol className="relative space-y-5 border-l-2 border-line pl-5">
                {timeline.map((r) => (
                  <li key={r.id} className="relative">
                    <span aria-hidden className={`absolute top-1.5 -left-[27px] size-3 rounded-full ring-4 ring-surface ${r.status === "approved" ? "bg-success-500" : r.status === "rejected" ? "bg-error-500" : "bg-warning-500"}`} />
                    <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_220px] lg:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                          Attempt {r.attempt} <StatusPill status={r.status} />
                        </div>
                        <div className="num mt-0.5 text-[12px] text-muted">Submitted {fmtDateTime(r.submittedAt)}</div>
                        {r.decidedAt && <div className="num text-[12px] text-muted">Decided {fmtDateTime(r.decidedAt)} · {r.decidedBy}</div>}
                        {r.reason && <div className="mt-1 text-[12.5px] text-error-600">Reason: {r.reason}</div>}
                      </div>
                      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
                        {r.checks.map((c) => (
                          <div key={c.id} className="contents">
                            <dt className="text-muted">{checkLabel(c.check)}</dt>
                            <dd className="min-w-0 break-words">
                              {[c.documentType, c.documentMasked].filter(Boolean).join(" · ") || "—"}
                              {c.matchScore !== undefined && <span className={c.matchScore < 70 ? "font-semibold text-error-600" : "text-muted"}> · {c.matchScore}% match</span>}
                              <span className="block font-mono text-[11px] text-muted">{c.provider} · {c.reference}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="flex flex-col gap-2 lg:items-end">
                        {r.checks.some((c) => c.check === "liveness" || c.check === "id_document") && <EvidencePlaceholder canView={canMedia} />}
                        {r.status === "pending" && (canDecide ? <KycDecision id={r.id} title={kycTierTitle(r.tier)} /> : <span className="text-[12px] text-muted">Awaiting a reviewer</span>)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </li>
        );
      })}
    </ol>
  );
}
