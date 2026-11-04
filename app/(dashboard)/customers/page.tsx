import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { Pagination } from "@/components/ui/Pagination";
import { Empty, PageHeader, Sheet } from "@/components/ui/Panel";
import { ClearFilters, ParamPicker } from "@/components/ui/ParamControls";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Toolbar } from "@/components/ui/Toolbar";
import { listCustomers } from "@/lib/data/repo";
import { CUSTOMER_LABELS } from "@/lib/domain/catalog";
import { fmtInt } from "@/lib/format";
import { flat, oneOf, pageOf, str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Customers" };

const KEYS = ["q", "tags", "kyc", "status", "label"];

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <>
      <PageHeader title="Customers" subtitle="Find anyone by name, email, @tag, phone or tags, then open their full profile." />
      <div className="space-y-4">
        <Suspense fallback={<Skeleton className="h-[132px] rounded-card" />}>
          <CustomerSearch labels={CUSTOMER_LABELS} />
          <Toolbar>
            <ParamPicker param="kyc" label="KYC" options={[0, 1, 2, 3].map((t) => ({ value: String(t), label: `Tier ${t}` }))} />
            <ParamPicker param="status" label="Status" options={["active", "frozen", "closed"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
            <ClearFilters />
          </Toolbar>
        </Suspense>
        <Suspense fallback={<TableSkeleton rows={14} />}>
          <Gate perm="customers.view">
            <Results searchParams={searchParams} />
          </Gate>
        </Suspense>
      </div>
    </>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/customers">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const tags = (str(sp, "tags", 300) ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
  // The API filters by one label and one search term: the first label chip
  // becomes the label filter, the first @handle chip the search (if empty).
  const handle = tags.find((t) => t.startsWith("@"))?.slice(1);
  const label = str(sp, "label", 24) ?? tags.find((t) => !t.startsWith("@"));
  const res = await listCustomers({
    q: str(sp, "q", 120) ?? handle, kyc: oneOf(sp, "kyc", ["0", "1", "2", "3"]), status: oneOf(sp, "status", ["active", "frozen", "closed"]), label, page: pageOf(sp),
  });
  const searching = !!str(sp, "q") || tags.length > 0;
  return (
    <Sheet head={<span><b className="num text-fg">{fmtInt(res.total)}</b> {searching ? `match${res.total === 1 ? "" : "es"}` : "customers"}{tags.length > 1 ? " · the API filters by one label and one @handle at a time" : ""}</span>}>
      {res.rows.length ? <CustomerTable rows={res.rows} now={res.now} /> : <Empty title="No customer found" hint="Check the spelling, try fewer tags, or clear the filters." />}
      <Pagination path="/customers" params={flat(sp, KEYS)} {...res} />
    </Sheet>
  );
}
