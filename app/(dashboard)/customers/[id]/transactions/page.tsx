import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { TxTable } from "@/components/transactions/TxTable";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { hrefWith, Pagination } from "@/components/ui/Pagination";
import { Empty } from "@/components/ui/Panel";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getCustomerTransactions } from "@/lib/data/repo";
import { CATEGORIES } from "@/lib/domain/catalog";
import type { TxCategory } from "@/lib/domain/types";
import { oneOf, pageOf, type SP } from "@/lib/params";

const CATS = CATEGORIES.map((c) => c.id);

export default function CustomerTransactionsPage(props: PageProps<"/customers/[id]/transactions">) {
  return (
    <Suspense fallback={<TableSkeleton rows={12} />}>
      <Gate perm="transactions.view"><Results {...props} /></Gate>
    </Suspense>
  );
}

async function Results({ params, searchParams }: PageProps<"/customers/[id]/transactions">) {
  const [{ id }, sp] = await Promise.all([params, searchParams as Promise<SP>]);
  const category = oneOf(sp, "category", CATS) as TxCategory | undefined;
  const res = await getCustomerTransactions(id, { category, page: pageOf(sp) });
  const path = `/customers/${id}/transactions`;
  return (
    <div className="space-y-3">
      <LinkTabs
        label="Transaction categories"
        items={[
          { href: path, label: "All", count: res.counts.all ?? 0, active: !category },
          ...CATEGORIES.map((c) => ({ href: hrefWith(path, {}, { category: c.id }), label: c.label, count: res.counts[c.id] ?? 0, active: category === c.id })),
        ]}
      />
      <div className="card overflow-hidden">
        {res.rows.length ? <TxTable rows={res.rows} showCustomer={false} category={category} /> : <Empty title="No transactions here" />}
        <Pagination path={path} params={{ category }} {...res} />
      </div>
    </div>
  );
}
