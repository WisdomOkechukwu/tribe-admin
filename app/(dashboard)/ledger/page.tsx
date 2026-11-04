import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { AccountsBrowser, EntrySection } from "@/components/ledger/LedgerSections";
import { VerifyLedgerButton } from "@/components/ledger/LedgerTools";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { AssetIcon, Money } from "@/components/ui/Money";
import { hrefWith } from "@/components/ui/Pagination";
import { Empty, PageHeader } from "@/components/ui/Panel";
import { ClearFilters, ParamDate } from "@/components/ui/ParamControls";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Toolbar } from "@/components/ui/Toolbar";
import { getAccess } from "@/lib/auth/current";
import { loadAccountLegs, loadJournalEntry, loadLedgerAccounts } from "@/lib/actions/sections";
import { listSnapshots } from "@/lib/data/repo";
import { fmtDateTime, fmtInt } from "@/lib/format";
import { flat, isoDay, oneOf, str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Ledger" };

export default function LedgerPage({ searchParams }: PageProps<"/ledger">) {
  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle="The double-entry book behind every balance: accounts and their legs, journal entries, and the daily closing snapshots. Verify re-checks that every entry nets to zero and balances match."
        actions={<Suspense fallback={null}><VerifyIfAllowed /></Suspense>}
      />
      <Suspense fallback={<TableSkeleton rows={14} text="Opening the books…" />}>
        <Gate perm="ledger.view"><Ledger searchParams={searchParams} /></Gate>
      </Suspense>
    </>
  );
}

async function VerifyIfAllowed() {
  const a = await getAccess();
  return a.has("ledger.view") ? <VerifyLedgerButton /> : null;
}

async function Ledger({ searchParams }: Pick<PageProps<"/ledger">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const tab = oneOf(sp, "tab", ["snapshots"]) ?? "accounts";
  const entry = str(sp, "entry", 40);
  const browse = { owner: str(sp, "owner", 40), asset: str(sp, "asset", 10), account: str(sp, "account", 12), page: str(sp, "page") };
  return (
    <div className="space-y-6">
      <EntrySection initial={loadJournalEntry({ entry })} initialParams={{ entry }} />
      <LinkTabs
        label="Ledger view"
        items={[
          { href: hrefWith("/ledger", flat(sp, ["entry"]), {}), label: "Accounts", active: tab === "accounts" },
          { href: hrefWith("/ledger", flat(sp, ["entry"]), { tab: "snapshots" }), label: "Daily snapshots", active: tab === "snapshots" },
        ]}
      />
      {tab === "snapshots" ? (
        <Suspense fallback={<TableSkeleton rows={12} />}><Snapshots sp={sp} /></Suspense>
      ) : (
        <AccountsBrowser accounts={loadLedgerAccounts(browse)} legs={loadAccountLegs(browse)} initialParams={browse} />
      )}
    </div>
  );
}

async function Snapshots({ sp }: { sp: SP }) {
  const { date, rows } = await listSnapshots(isoDay(sp, "date"));
  const shown = rows.filter((r) => /[1-9]/.test(r.closing));
  return (
    <div className="card overflow-hidden">
      <Toolbar className="px-5 py-3">
        <ParamDate param="date" label="Date" />
        <ClearFilters keep={["tab"]} />
      </Toolbar>
      <div className="border-y-2 border-line bg-sunken px-5 py-2.5 text-[12.5px] text-muted">
        Closing balances for <b className="text-fg">{date || "—"}</b> · {fmtInt(rows.length)} accounts snapshotted, {fmtInt(shown.length)} non-zero shown
      </div>
      {shown.length === 0 ? <Empty title="No snapshots for this day" hint="Run the daily snapshot from Jobs, or pick another date." /> : (
        <Table>
          <THead><Th>Account</Th><Th>Account no.</Th><Th className="text-right">Closing balance</Th><Th className="text-right">Last leg</Th><Th>Taken</Th></THead>
          <tbody>
            {shown.map((s) => (
              <Tr key={s.id}>
                <Td><Link href={`/ledger?account=${s.ledgerAccountId}`} className="inline-flex items-center gap-2"><AssetIcon asset={s.asset} size={16} /><span className="link font-semibold">{s.accountName}</span></Link></Td>
                <Td className="font-mono text-[12px] text-muted">{s.accountNumber}</Td>
                <Td className="text-right font-semibold"><Money asset={s.asset} amount={s.closing} /></Td>
                <Td className="num text-right text-muted">#{s.lastJournalLegId}</Td>
                <Td className="text-muted">{fmtDateTime(s.createdAt)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
