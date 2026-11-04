import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { ApiList } from "@/components/transactions/ApiList";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { hrefWith, Pagination } from "@/components/ui/Pagination";
import { Empty } from "@/components/ui/Panel";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getCustomerApiTrail } from "@/lib/data/repo";
import { fmtInt } from "@/lib/format";
import { ClearFilters, ParamPicker, ParamSearch } from "@/components/ui/ParamControls";
import { Toolbar } from "@/components/ui/Toolbar";
import { flat, oneOf, pageOf, str, type SP } from "@/lib/params";

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

export default function CustomerTrailPage(props: PageProps<"/customers/[id]/api-trail">) {
  return (
    <Suspense fallback={<TableSkeleton rows={12} />}>
      <Gate perm="api.view"><Results {...props} /></Gate>
    </Suspense>
  );
}

async function Results({ params, searchParams }: PageProps<"/customers/[id]/api-trail">) {
  const [{ id }, sp] = await Promise.all([params, searchParams as Promise<SP>]);
  const status = oneOf(sp, "status", ["2xx", "4xx", "5xx"]);
  const res = await getCustomerApiTrail(id, {
    status, method: oneOf(sp, "method", METHODS), path: str(sp, "path", 80), minLatency: Number(oneOf(sp, "slow", ["300", "1000"])) || undefined, page: pageOf(sp),
  });
  const keep = flat(sp, ["method", "path", "slow"]);
  const path = `/customers/${id}/api-trail`;
  return (
    <div className="space-y-3">
      <LinkTabs
        label="Status filter"
        items={[{ v: undefined, l: "All" }, { v: "2xx", l: "Success" }, { v: "4xx", l: "Client errors" }, { v: "5xx", l: "Server errors" }].map((s) => ({
          href: hrefWith(path, keep, { status: s.v }), label: s.l, active: status === s.v,
        }))}
      />
      <Toolbar>
        <ParamSearch param="path" placeholder="Path contains…" className="w-full sm:w-64" />
        <ParamPicker param="method" label="Method" options={METHODS.map((m) => ({ value: m, label: m }))} />
        <ParamPicker param="slow" label="Latency" placeholder="Any" options={[{ value: "1000", label: "Slow (≥ 1s)" }, { value: "300", label: "≥ 300ms" }]} />
        <ClearFilters keep={["status"]} />
      </Toolbar>
      <div className="card overflow-hidden">
        <div className="border-b-2 border-line bg-sunken px-5 py-3 text-[12.5px] text-muted">{fmtInt(res.total)} requests · click a row for request and response</div>
        {res.rows.length ? <ApiList rows={res.rows} showCustomer={false} /> : <Empty title="No requests" />}
        <Pagination path={path} params={{ status, ...keep }} {...res} />
      </div>
    </div>
  );
}
