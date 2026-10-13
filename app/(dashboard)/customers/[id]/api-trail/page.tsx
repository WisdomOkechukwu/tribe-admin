import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { ApiList } from "@/components/transactions/ApiList";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { hrefWith, Pagination } from "@/components/ui/Pagination";
import { Empty } from "@/components/ui/Panel";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getCustomerApiTrail } from "@/lib/data/repo";
import { fmtInt } from "@/lib/format";
import { oneOf, pageOf, type SP } from "@/lib/params";

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
  const res = await getCustomerApiTrail(id, { status, page: pageOf(sp) });
  const path = `/customers/${id}/api-trail`;
  return (
    <div className="space-y-3">
      <LinkTabs
        label="Status filter"
        items={[{ v: undefined, l: "All" }, { v: "2xx", l: "Success" }, { v: "4xx", l: "Client errors" }, { v: "5xx", l: "Server errors" }].map((s) => ({
          href: hrefWith(path, {}, { status: s.v }), label: s.l, active: status === s.v,
        }))}
      />
      <div className="card overflow-hidden">
        <div className="border-b-2 border-line bg-sunken px-5 py-3 text-[12.5px] text-muted">{fmtInt(res.total)} requests · click a row for request and response</div>
        {res.rows.length ? <ApiList rows={res.rows} showCustomer={false} /> : <Empty title="No requests" />}
        <Pagination path={path} params={{ status }} {...res} />
      </div>
    </div>
  );
}
