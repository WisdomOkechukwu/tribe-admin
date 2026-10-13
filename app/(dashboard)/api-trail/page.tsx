import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { ApiList } from "@/components/transactions/ApiList";
import { Pagination } from "@/components/ui/Pagination";
import { Empty, PageHeader } from "@/components/ui/Panel";
import { ClearFilters, ParamPicker, ParamSearch } from "@/components/ui/ParamControls";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { listApiTrail } from "@/lib/data/repo";
import { fmtInt, fmtPct } from "@/lib/format";
import { flat, oneOf, pageOf, str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "API trail" };

const KEYS = ["q", "method", "status", "path", "slow"];

export default function ApiTrailPage({ searchParams }: PageProps<"/api-trail">) {
  return (
    <>
      <PageHeader title="API trail" subtitle="Every request customers' apps and providers made to Tribe. Bodies are redacted (PINs, codes, passwords)." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Suspense fallback={<div className="h-8 w-72 rounded-chip border border-line bg-surface" />}>
          <ParamSearch placeholder="Customer email, @tag, request ID or tx ID" className="w-full sm:w-80" />
          <ParamSearch param="path" placeholder="Path contains… (e.g. /v1/swaps)" className="w-full sm:w-64" />
          <ParamPicker param="method" label="Method" options={["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => ({ value: m, label: m }))} />
          <ParamPicker param="status" label="Status" options={[{ value: "2xx", label: "2xx success" }, { value: "4xx", label: "4xx client error" }, { value: "5xx", label: "5xx server error" }]} />
          <ParamPicker param="slow" label="Latency" placeholder="Any" options={[{ value: "1", label: "Slow (≥ 1s)" }]} />
          <ClearFilters />
        </Suspense>
      </div>
      <Suspense fallback={<TableSkeleton rows={16} />}>
        <Gate perm="api.view"><Results searchParams={searchParams} /></Gate>
      </Suspense>
    </>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/api-trail">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const res = await listApiTrail({
    q: str(sp, "q", 120), path: str(sp, "path", 80), method: oneOf(sp, "method", ["GET", "POST", "PATCH", "PUT", "DELETE"]),
    status: oneOf(sp, "status", ["2xx", "4xx", "5xx"]), slow: oneOf(sp, "slow", ["1"]), page: pageOf(sp),
  });
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-x-6 border-b-2 border-line bg-sunken px-5 py-3 text-[12.5px] text-muted">
        <span><b className="num text-fg">{fmtInt(res.total)}</b> requests</span>
        <span>5xx share <b className="num text-fg">{fmtPct(res.errorRate * 100, 2)}</b></span>
        <span className="hidden sm:inline">Click a row for request/response</span>
      </div>
      {res.rows.length ? <ApiList rows={res.rows} /> : <Empty title="No requests match" />}
      <Pagination path="/api-trail" params={flat(sp, KEYS)} {...res} />
    </div>
  );
}
