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

// Prefixes of the API's audit actions (e.g. inventory.approve, fees.update).
const GROUPS = [
  { v: undefined, l: "All" }, { v: "inventory", l: "Treasury" }, { v: "fees", l: "Fees" }, { v: "rates", l: "Margins" }, { v: "kyc", l: "KYC" },
  { v: "customer", l: "Customers" }, { v: "support", l: "Support" }, { v: "providers", l: "Providers" }, { v: "card_designs", l: "Card designs" },
  { v: "jobs", l: "Jobs" }, { v: "team", l: "Team" }, { v: "auth", l: "Sign-ins" },
] as const;
const ACTIONS = GROUPS.flatMap((g) => (g.v ? [g.v] : []));

export default function AuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin action: who did it and exactly what changed. Click a row for the full details. Append-only." />
      <div className="space-y-4">
        {/* The tabs only need the URL, so they render before the log arrives. */}
        <Suspense fallback={<Tabs action={null} />}>
          <ActiveTabs searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<TableSkeleton rows={14} />}>
          <Gate perm="audit.view">
            <Log searchParams={searchParams} />
          </Gate>
        </Suspense>
      </div>
    </>
  );
}

/** `action` null: nothing highlighted yet (the static shell, before the URL is read). */
const Tabs = ({ action }: { action: string | undefined | null }) => <LinkTabs label="Action type" items={GROUPS.map((g) => ({ href: g.v ? `/audit?action=${g.v}` : "/audit", label: g.l, active: action !== null && action === g.v }))} />;

async function ActiveTabs({ searchParams }: Pick<PageProps<"/audit">, "searchParams">) {
  return <Tabs action={oneOf((await searchParams) as SP, "action", ACTIONS)} />;
}

async function Log({ searchParams }: Pick<PageProps<"/audit">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const action = oneOf(sp, "action", ACTIONS);
  const res = await listAudit({ action, page: pageOf(sp) });
  return (
    <Sheet head={<span><b className="num text-fg">{fmtInt(res.total)}</b> events · newest first</span>}>
      {res.rows.length === 0 ? <Empty title="Nothing logged yet" /> : <AuditList rows={res.rows} />}
      <Pagination path="/audit" params={{ action }} {...res} />
    </Sheet>
  );
}
