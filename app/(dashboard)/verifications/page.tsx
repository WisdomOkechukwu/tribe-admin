import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { KycDecision } from "@/components/kyc/KycDecision";
import { MediaGallery } from "@/components/kyc/MediaGallery";
import { Icon } from "@/components/shell/icons";
import { KycBadge, StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { Empty, PageHeader, Sheet } from "@/components/ui/Panel";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { DATA_NOW, listVerificationQueue } from "@/lib/data/repo";
import { CHECK_LABEL } from "@/lib/domain/catalog";
import { fmtAgo, fmtDateTime, fmtInt } from "@/lib/format";
import { oneOf, pageOf, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Verifications" };

// One grid for header + rows so every column lines up.
const GRID = "grid-cols-[minmax(170px,1.1fr)_minmax(180px,1.2fr)_minmax(150px,1fr)_110px_100px_200px]";

export default function VerificationsPage({ searchParams }: PageProps<"/verifications">) {
  return (
    <>
      <PageHeader title="Verifications" subtitle="QoreID checks that need a human, oldest first. Approving every check in a tier upgrades the customer. Click a thumbnail to zoom or compare against the record photo." />
      <Suspense fallback={<TableSkeleton rows={12} />}>
        <Gate perm="kyc.view">
          <Queue searchParams={searchParams} />
        </Gate>
      </Suspense>
    </>
  );
}

function Score({ v }: { v?: number }) {
  if (v === undefined) return <span className="text-[12px] text-muted">n/a</span>;
  const bad = v < 70;
  return (
    <div className="w-full max-w-24">
      <div className={cx("num text-[13px] font-extrabold", bad && "text-error-600 dark:text-error-50")}>{v}%</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken"><div className={cx("h-full rounded-full", bad ? "bg-error-500" : v < 85 ? "bg-warning-500" : "bg-success-500")} style={{ width: `${v}%` }} /></div>
    </div>
  );
}

async function Queue({ searchParams }: Pick<PageProps<"/verifications">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const status = oneOf(sp, "status", ["pending", "approved", "failed"]) ?? "pending";
  const [res, access] = await Promise.all([listVerificationQueue({ status, page: pageOf(sp) }), getAccess()]);
  const canDecide = access.has("kyc.decide") && status === "pending";
  const canMedia = access.has("kyc.media");
  return (
    <div className="space-y-4">
      <LinkTabs
        label="Verification status"
        items={(["pending", "approved", "failed"] as const).map((s) => ({ href: s === "pending" ? "/verifications" : `/verifications?status=${s}`, label: s === "pending" ? "Awaiting review" : s === "approved" ? "Approved" : "Rejected", count: res.counts[s] ?? 0, active: status === s }))}
      />
      <Sheet head={<span><b className="num text-fg">{fmtInt(res.total)}</b> checks{status === "pending" ? " waiting · oldest first" : ""}</span>}>
        {res.rows.length === 0 ? (
          <Empty title="Queue is clear" hint="New QoreID submissions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1040px]">
              <div className={cx("grid items-center gap-5 border-b-2 border-line px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted", GRID)}>
                <span>Customer</span><span>Check</span><span>Evidence</span><span>Match</span><span>Status</span><span className="text-right">{canDecide ? "Decision" : "Decided by"}</span>
              </div>
              <ul>
                {res.rows.map((v) => (
                  <li key={v.id} className={cx("row-cv grid items-center gap-5 border-b border-line px-5 py-4 last:border-0 hover:bg-purple-50/50 dark:hover:bg-purple-900/20", GRID)}>
                    <div className="min-w-0">
                      <Link href={`/customers/${v.customerId}/verifications`} className="link block truncate">{v.customerName}</Link>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                        <span className="truncate">@{v.customerTag}</span>
                        <KycBadge tier={v.currentTier} />
                      </div>
                      <div className="num mt-1 text-[11.5px] text-muted" title={fmtDateTime(v.submittedAt)}>Submitted {fmtAgo(v.submittedAt, DATA_NOW)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold">{CHECK_LABEL[v.check]} <span className="font-normal text-muted">· Tier {v.tier}</span></div>
                      <div className="mt-1 truncate text-[12px] text-muted" title={`${v.documentType ?? ""} ${v.documentMasked ?? ""}`}>{v.documentType}{v.documentMasked ? ` · ${v.documentMasked}` : ""}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted">{v.reference}</div>
                    </div>
                    <div className="min-w-0">
                      {!canMedia ? (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted"><Icon name="lock" size={12} /> Hidden</span>
                      ) : v.media.length ? (
                        <MediaGallery media={v.media} reference={v.referencePhoto} size="sm" title={`${v.customerName} · ${CHECK_LABEL[v.check]}`} />
                      ) : (
                        <span className="text-[12px] text-muted">No image needed</span>
                      )}
                    </div>
                    <Score v={v.matchScore} />
                    <div><StatusPill status={v.status} /></div>
                    <div className="flex justify-end">
                      {canDecide ? <KycDecision id={v.id} /> : <span className="max-w-48 text-right text-[12px] text-muted">{v.decidedBy ?? "—"}{v.reason ? ` · ${v.reason}` : ""}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <Pagination path="/verifications" params={{ status: status === "pending" ? undefined : status }} {...res} />
      </Sheet>
    </div>
  );
}
