import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { KycDecision } from "@/components/kyc/KycDecision";
import { MediaGallery } from "@/components/kyc/MediaGallery";
import { Icon } from "@/components/shell/icons";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Empty, Panel } from "@/components/ui/Panel";
import { BrandLoader, PanelSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { getCustomerVerifications } from "@/lib/data/repo";
import { CHECK_LABEL, TIER_LIMITS } from "@/lib/domain/catalog";
import { fmtDateTime } from "@/lib/format";

const TIER_TITLE = { 1: "Tier 1 · BVN + date of birth", 2: "Tier 2 · NIN + selfie liveness", 3: "Tier 3 · ID document + address" } as const;

export default function VerificationsTab({ params }: PageProps<"/customers/[id]/verifications">) {
  return (
    <Suspense fallback={<div className="space-y-6"><PanelSkeleton><BrandLoader text="Loading checks…" /></PanelSkeleton><PanelSkeleton /></div>}>
      <Gate perm="kyc.view"><Checks params={params} /></Gate>
    </Suspense>
  );
}

async function Checks({ params }: Pick<PageProps<"/customers/[id]/verifications">, "params">) {
  const { id } = await params;
  const [checks, access] = await Promise.all([getCustomerVerifications(id), getAccess()]);
  const canDecide = access.has("kyc.decide");
  const canMedia = access.has("kyc.media");
  const reference = checks.flatMap((c) => c.media).find((m) => m.kind === "bvn_photo") ?? checks.flatMap((c) => c.media).find((m) => m.kind === "nin_photo");
  if (!checks.length) return <div className="card overflow-hidden"><Empty title="No verification attempts yet" hint="Tier 0: the customer hasn't started KYC." /></div>;

  return (
    <ol className="space-y-6">
      {([1, 2, 3] as const).map((tier) => {
        const rows = checks.filter((c) => c.tier === tier);
        if (!rows.length) return null;
        const done = rows.every((r) => r.status === "approved");
        return (
          <li key={tier}>
            <Panel
              title={<span className="flex items-center gap-2">{TIER_TITLE[tier]} {done ? <Badge tone="success">Passed</Badge> : rows.some((r) => r.status === "failed") ? <Badge tone="error">Failed</Badge> : <Badge tone="warning">In review</Badge>}</span>}
              action={<span className="text-[12px] text-muted">Unlocks {TIER_LIMITS[tier].daily}/day</span>}
              bodyClass="divide-y-2 divide-line px-5 py-5"
            >
              {rows.map((v) => (
                <div key={v.id} className="grid grid-cols-1 gap-x-6 gap-y-4 py-5 first:pt-0 last:pb-0 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.2fr)_220px] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2 font-medium">{CHECK_LABEL[v.check]} <StatusPill status={v.status} /></div>
                    <div className="mt-0.5 text-[12px] text-muted">{v.provider} · <span className="font-mono">{v.reference}</span></div>
                  </div>
                  <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
                    {v.documentType && <><dt className="text-muted">Document</dt><dd>{v.documentType}</dd></>}
                    {v.documentMasked && <><dt className="text-muted">Value</dt><dd className="num break-words">{v.documentMasked}</dd></>}
                    {v.matchScore !== undefined && <><dt className="text-muted">Match score</dt><dd className={v.matchScore < 70 ? "font-semibold text-error-600" : ""}>{v.matchScore}%</dd></>}
                    <dt className="text-muted">Submitted</dt><dd>{fmtDateTime(v.submittedAt)}</dd>
                    {v.decidedAt && <><dt className="text-muted">Decided</dt><dd>{fmtDateTime(v.decidedAt)} · {v.decidedBy}</dd></>}
                    {v.reason && <><dt className="text-muted">Reason</dt><dd className="text-error-600">{v.reason}</dd></>}
                  </dl>
                  <div>
                    <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-muted">Evidence</div>
                    {!canMedia ? <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-line px-2.5 py-1 text-[11.5px] text-muted"><Icon name="lock" size={12} /> Images hidden</span> : v.media.length ? <MediaGallery media={v.media} reference={reference} title={`Tier ${v.tier} · ${CHECK_LABEL[v.check]}`} /> : <span className="text-[12px] text-muted">No image required</span>}
                  </div>
                  <div className="flex lg:justify-end">{v.status === "pending" && canDecide ? <KycDecision id={v.id} /> : <span className="text-[12px] text-muted">{v.status === "pending" ? "Awaiting a reviewer" : `Decided ${v.decidedAt ? fmtDateTime(v.decidedAt) : ""}`}</span>}</div>
                </div>
              ))}
            </Panel>
          </li>
        );
      })}
    </ol>
  );
}
