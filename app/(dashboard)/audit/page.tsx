import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { AuditList } from "@/components/audit/AuditList";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { Empty, PageHeader, Sheet } from "@/components/ui/Panel";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { listAudit } from "@/lib/data/repo";
import { fmtInt } from "@/lib/format";
import { oneOf, pageOf, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Audit log" };

const GROUPS = [
  { v: undefined, l: "All" }, { v: "inventory", l: "Inventory" }, { v: "markup", l: "Markups" }, { v: "kyc", l: "KYC" },
  { v: "customer", l: "Customers" }, { v: "support", l: "Support" }, { v: "team", l: "Team" }, { v: "log", l: "Sign-ins" },
] as const;

export default function AuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin action: who did it and exactly what changed. Click a row for the full details. Append-only." />
      <Suspense fallback={<TableSkeleton rows={14} />}>
        <Gate perm="audit.view">
          <Log searchParams={searchParams} />
        </Gate>
      </Suspense>
    </>
  );
}

async function Log({ searchParams }: Pick<PageProps<"/audit">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const action = oneOf(sp, "action", ["inventory", "markup", "kyc", "customer", "support", "team", "log"]);
  const res = await listAudit({ action, page: pageOf(sp) });
  return (
    <div className="space-y-4">
      <LinkTabs label="Action type" items={GROUPS.map((g) => ({ href: g.v ? `/audit?action=${g.v}` : "/audit", label: g.l, active: action === g.v }))} />
      <Sheet head={<span><b className="num text-fg">{fmtInt(res.total)}</b> events · newest first</span>}>
        {res.rows.length === 0 ? <Empty title="Nothing logged yet" /> : <AuditList rows={res.rows} />}
        <Pagination path="/audit" params={{ action }} {...res} />
      </Sheet>
    </div>
  );
}
