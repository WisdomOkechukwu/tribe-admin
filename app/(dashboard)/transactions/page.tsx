import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { MarkupsButton } from "@/components/markups/MarkupModal";
import { TxTable } from "@/components/transactions/TxTable";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { hrefWith, Pagination } from "@/components/ui/Pagination";
import { Empty, PageHeader } from "@/components/ui/Panel";
import { ClearFilters, ParamDate, ParamPicker, ParamSearch } from "@/components/ui/ParamControls";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Toolbar } from "@/components/ui/Toolbar";
import { listTransactions } from "@/lib/data/repo";
import { ASSET_CODES, CATEGORIES, TX_TYPES, typesFor } from "@/lib/domain/catalog";
import type { TxCategory } from "@/lib/domain/types";
import { fmtCompact, fmtInt, fmtNgnCompact } from "@/lib/format";
import { flat, isoDay, oneOf, pageOf, str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Transactions" };

const CATS = CATEGORIES.map((c) => c.id);
const KEYS = ["category", "type", "status", "asset", "q", "from", "to"];
const STATUSES = ["completed", "pending", "failed", "reversed", "cancelled"] as const;

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <>
      <PageHeader title="Transactions" subtitle="Every money movement, split by product. Open one to see its legs and inventory impact." actions={<MarkupsButton />} />
      <div className="space-y-4">
        <Suspense fallback={<div className="space-y-4"><Skeleton className="h-11 w-full max-w-3xl rounded-full" /><Skeleton className="h-8 w-full max-w-4xl rounded-full" /></div>}>
          <Tabs searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<TableSkeleton rows={14} text="Fetching transactions…" />}>
          <Gate perm="transactions.view"><Results searchParams={searchParams} /></Gate>
        </Suspense>
      </div>
    </>
  );
}

function parse(sp: SP) {
  return {
    category: oneOf(sp, "category", CATS) as TxCategory | undefined,
    type: oneOf(sp, "type", TX_TYPES.map((t) => t.type)),
    status: oneOf(sp, "status", STATUSES),
    asset: oneOf(sp, "asset", ASSET_CODES),
    q: str(sp, "q", 64),
    from: isoDay(sp, "from"),
    to: isoDay(sp, "to"),
    page: pageOf(sp),
  };
}

async function Tabs({ searchParams }: Pick<PageProps<"/transactions">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const f = parse(sp);
  const base = flat(sp, KEYS);
  const types = f.category ? typesFor(f.category) : TX_TYPES;
  return (
    <div className="space-y-4">
      <LinkTabs
        label="Transaction categories"
        items={[
          { href: hrefWith("/transactions", base, { category: undefined, type: undefined }), label: "All", active: !f.category },
          ...CATEGORIES.map((c) => ({ href: hrefWith("/transactions", base, { category: c.id, type: undefined }), label: c.label, active: f.category === c.id })),
        ]}
      />
      <Toolbar>
        <ParamSearch placeholder={f.category === "cashpoint" ? "Reference or 12-digit cashpoint code" : f.category === "utility" ? "Reference, meter, phone or token" : "Reference, code, meter or card last 4"} className="w-full sm:w-80" />
        <ParamPicker key={`type-${f.category ?? "all"}`} param="type" label="Type" options={types.map((t) => ({ value: t.type, label: t.label }))} />
        <ParamPicker param="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
        <ParamPicker param="asset" label="Asset" options={ASSET_CODES.map((a) => ({ value: a, label: a }))} />
        <ParamDate param="from" label="From" />
        <ParamDate param="to" label="To" />
        <ClearFilters keep={["category"]} />
      </Toolbar>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/transactions">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const f = parse(sp);
  const res = await listTransactions(f);
  return (
    <div className="card overflow-hidden">
      <div className="flex min-h-12 flex-wrap items-center gap-x-6 gap-y-1 border-b-2 border-line bg-sunken px-5 py-3 text-[12.5px] text-muted">
        <span><b className="num text-fg">{fmtInt(res.total)}</b> transactions</span>
        <span>Completed volume <b className="num text-fg">${fmtCompact(res.volumeUsd)}</b></span>
        <span>Markup revenue <b className="num text-fg">{fmtNgnCompact(res.revenueNgn)}</b></span>
        {!f.category && (
          <span className="hidden lg:inline">
            {CATEGORIES.map((c) => `${c.short} ${fmtInt(res.counts[c.id] ?? 0)}`).join(" · ")}
          </span>
        )}
      </div>
      {res.rows.length ? <TxTable rows={res.rows} category={f.category} /> : <Empty title="No transactions match" hint="Try another category, or clear the filters." />}
      <Pagination path="/transactions" params={flat(sp, KEYS)} {...res} />
    </div>
  );
}
