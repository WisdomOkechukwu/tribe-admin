"use client";

import Link from "next/link";
import { EvidencePlaceholder } from "@/components/kyc/EvidencePlaceholder";
import { KycDecision } from "@/components/kyc/KycDecision";
import { Badge, KycBadge, StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { ButtonTabs, TabCount } from "@/components/ui/LinkTabs";
import { PageButtons } from "@/components/ui/Pagination";
import { Empty, Sheet } from "@/components/ui/Panel";
import { SectionBody, Streamed } from "@/components/ui/Section";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { loadVerifications } from "@/lib/actions/sections";
import { attemptLabel, checkLabel, kycTierTitle } from "@/lib/domain/catalog";
import type { VerificationCheck } from "@/lib/domain/types";
import { useSection, type SectionParams, type SectionResult } from "@/lib/hooks/useSection";
import { fmtAgo, fmtDateTime, fmtInt } from "@/lib/format";

// One grid for header + rows so every column lines up.
const GRID = "grid-cols-[minmax(170px,1fr)_minmax(240px,1.5fr)_minmax(150px,0.9fr)_110px_minmax(190px,auto)]";
const STATUSES = ["pending", "approved", "rejected"] as const;
const TAB_LABEL: Record<(typeof STATUSES)[number], string> = { pending: "Awaiting review", approved: "Approved", rejected: "Rejected" };
const DAY = 24 * 60 * 60 * 1000;

/**
 * The queue is its own section: switching tabs or pages reloads only the table
 * (?status & ?page). The tab counts stream in separately and only refresh when
 * the server re-renders (after a decision).
 */
export function VerificationQueue({ initial, initialParams, counts, canDecide, canMedia }: {
  initial: ReturnType<typeof loadVerifications>;
  initialParams: SectionParams<"status" | "page">;
  counts: Promise<SectionResult<Record<string, number>>>;
  canDecide: boolean;
  canMedia: boolean;
}) {
  const s = useSection({ initial, initialParams, load: loadVerifications, urlKeys: ["status", "page"] });
  const active = STATUSES.find((x) => x === s.params.status) ?? "pending";
  return (
    <div className="space-y-4">
      <ButtonTabs
        label="Verification status"
        onSelect={(v) => s.setParams({ status: v === "pending" ? undefined : v, page: undefined })}
        items={STATUSES.map((v) => ({
          value: v, label: TAB_LABEL[v], active: active === v,
          count: <Streamed value={counts} fallback={<Skeleton className="h-4 w-6 rounded-full" />}>{(c) => (c.ok ? <TabCount n={c.data[v] ?? 0} active={active === v} /> : null)}</Streamed>,
        }))}
      />
      <SectionBody section={s} fallback={<TableSkeleton rows={12} />}>
        {(d) => {
          const decide = canDecide && d.status === "pending";
          return (
            <Sheet head={<span><b className="num text-fg">{fmtInt(d.total)}</b> {d.total === 1 ? "request" : "requests"}{d.status === "pending" ? " waiting · oldest first" : ""}</span>}>
              {d.rows.length === 0 ? (
                <Empty title={d.status === "pending" ? "Queue is clear" : `No ${TAB_LABEL[d.status].toLowerCase()} requests`} hint={d.status === "pending" ? "New verification requests appear here." : undefined} />
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1000px]">
                    <div className={cx("grid items-center gap-5 border-b-2 border-line px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted", GRID)}>
                      <span>Customer</span><span>Request</span><span>Submitted</span><span>Status</span><span className="text-right">{decide ? "Decision" : "Decided by"}</span>
                    </div>
                    <ul>
                      {d.rows.map((v) => {
                        const overdue = v.status === "pending" && d.now - Date.parse(v.submittedAt) > DAY;
                        const retry = attemptLabel(v.attempt);
                        return (
                          <li key={v.id} className={cx("row-cv grid items-center gap-5 border-b border-line px-5 py-4 last:border-0 hover:bg-purple-50/50 dark:hover:bg-purple-900/20", GRID)}>
                            <div className="min-w-0">
                              <Link href={`/customers/${v.customerId}/verifications`} className="link block truncate">{v.customerName}</Link>
                              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                                <span className="truncate">@{v.customerTag}</span>
                                <KycBadge tier={v.currentTier} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                {kycTierTitle(v.tier)}
                                {retry && <Badge tone="orange">{retry}</Badge>}
                              </div>
                              <ul className="mt-1.5 space-y-0.5">{v.checks.map((c) => <CheckLine key={c.id} c={c} />)}</ul>
                              {v.previousReason && <div className="mt-1.5 truncate text-[12px] text-muted" title={v.previousReason}>Last rejected: <span className="text-error-600">{v.previousReason}</span></div>}
                              {v.checks.some((c) => c.check === "liveness" || c.check === "id_document") && <div className="mt-2"><EvidencePlaceholder canView={canMedia} /></div>}
                            </div>
                            <div className="min-w-0" title={fmtDateTime(v.submittedAt)}>
                              <div className={cx("num text-[13px]", overdue && "font-semibold")}>{fmtAgo(v.submittedAt, d.now)}</div>
                              {overdue && <Badge tone="warning" className="mt-1">Over 24h</Badge>}
                            </div>
                            <div><StatusPill status={v.status} /></div>
                            <div className="flex justify-end">
                              {decide ? (
                                <KycDecision id={v.id} title={`${kycTierTitle(v.tier)} for ${v.customerName}`} />
                              ) : (
                                <span className="max-w-52 text-right text-[12px] text-muted">
                                  {v.decidedBy ?? "—"}{v.decidedAt ? ` · ${fmtDateTime(v.decidedAt)}` : ""}
                                  {v.reason && <span className="block truncate text-error-600" title={v.reason}>{v.reason}</span>}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
              <PageButtons {...d} onPage={(p) => s.setParams({ page: p > 1 ? String(p) : undefined })} />
            </Sheet>
          );
        }}
      </SectionBody>
    </div>
  );
}

/** One check of a request: label, masked value, match score when the provider gave one. */
function CheckLine({ c }: { c: VerificationCheck }) {
  return (
    <li className="flex min-w-0 items-baseline gap-1.5 text-[12.5px]">
      <span className="shrink-0 font-semibold">{checkLabel(c.check)}</span>
      {c.documentType && <span className="truncate text-muted">{c.documentType}</span>}
      {c.documentMasked && <span className="num shrink-0 text-muted">{c.documentMasked}</span>}
      {c.matchScore !== undefined && <span className={cx("num shrink-0", c.matchScore < 70 ? "font-semibold text-error-600" : "text-muted")}>· {c.matchScore}% match</span>}
    </li>
  );
}
