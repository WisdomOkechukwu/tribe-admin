import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import { Suspense } from "react";
import { FundingForm } from "@/components/inventory/FundingForm";
import { AdjustmentsSection, EntriesSection, FundingsSection, VaultLink, type InventoryViewer } from "@/components/inventory/InventorySections";
import { Badge } from "@/components/ui/Badge";
import { AssetIcon, Money } from "@/components/ui/Money";
import { Empty, PageHeader, Panel } from "@/components/ui/Panel";
import { CardsSkeleton, Skeleton, TableSkeleton, TabsSkeleton } from "@/components/ui/Skeleton";
import { loadAdjustments, loadEntries, loadFundings } from "@/lib/actions/sections";
import { getAccess, type Access } from "@/lib/auth/current";
import { listFreeFunds, listInventory } from "@/lib/data/repo";
import { isSuperAdmin } from "@/lib/domain/permissions";
import { assetInfo } from "@/lib/domain/catalog";
import type { LedgerAccount } from "@/lib/domain/types";
import { signOf } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Inventory" };

// Every section streams on its own: vault cards from /inventory (the "free to
// credit" line from /free-funds fills in per card), the funding form, and three
// client sections (fundings, adjustments, movements) that each own their URL
// params and reload alone. /inventory is read once per render (repo cache).

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <>
      <PageHeader title="Inventory" subtitle="What the company holds per asset (company vault), plus customer money held in cashpoint escrow and payouts in transit. Treasury funding needs two people: one admin records it, a different admin approves it before it's posted." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Suspense fallback={<CardsSkeleton n={8} />}>
          <Gate perm="inventory.view"><Vaults /></Gate>
        </Suspense>
        <Panel title="Record treasury funding" className="order-first h-fit xl:sticky xl:top-24 xl:order-none">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <Gate perm="inventory.view" compact><Funding /></Gate>
          </Suspense>
        </Panel>
      </div>
      <div className="mt-10 scroll-mt-24" id="fundings">
        <h2 className="display mb-4 text-[28px] font-extrabold uppercase">Funding requests</h2>
        <Suspense fallback={<TabbedSkeleton rows={6} />}>
          <Gate perm="inventory.view" compact><Fundings searchParams={searchParams} /></Gate>
        </Suspense>
      </div>
      <div className="mt-10 scroll-mt-24" id="adjustments">
        <h2 className="display mb-1 text-[28px] font-extrabold uppercase">Manual credits &amp; debits</h2>
        <p className="mb-4 text-[13px] text-muted">Requested from a customer&apos;s profile. Only a super admin (not the requester) can approve. Credits come out of the vault&apos;s free funds; debits out of the customer&apos;s wallet.</p>
        <Suspense fallback={<TabbedSkeleton rows={6} />}>
          <Gate perm="inventory.view" compact><Adjustments searchParams={searchParams} /></Gate>
        </Suspense>
      </div>
      <div className="mt-10 scroll-mt-24" id="entries">
        <h2 className="display mb-4 text-[28px] font-extrabold uppercase">Vault movements</h2>
        <Suspense fallback={<TableSkeleton rows={12} />}>
          <Gate perm="inventory.view" compact><Entries searchParams={searchParams} /></Gate>
        </Suspense>
      </div>
    </>
  );
}

function TabbedSkeleton({ rows }: { rows: number }) {
  return <div className="space-y-3"><TabsSkeleton /><TableSkeleton rows={rows} /></div>;
}

const byAsset = (accounts: LedgerAccount[], code: string) => new Map(accounts.filter((a) => a.code === code).map((a) => [a.asset as string, a]));

async function Vaults() {
  const accounts = await listInventory();
  const vaults = accounts.filter((a) => a.code === "company_vault");
  const escrow = byAsset(accounts, "cashpoint_escrow");
  const transit = byAsset(accounts, "payout_in_transit");
  const groups = [
    { id: "fiat", label: "Fiat vaults", items: vaults.filter((v) => assetInfo(v.asset).kind === "fiat") },
    { id: "crypto", label: "Crypto vaults", items: vaults.filter((v) => assetInfo(v.asset).kind === "crypto") },
  ];
  if (!vaults.length) return <div className="card"><Empty title="No company vaults" hint="The ledger has no company_vault accounts yet." /></div>;
  return (
    <div className="space-y-8">
      {groups.map((g) => g.items.length > 0 && (
        <section key={g.id}>
          <h3 className="display mb-3 text-[24px] font-extrabold uppercase">{g.label}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {g.items.map((v) => {
              const e = escrow.get(v.asset), t = transit.get(v.asset);
              const negative = signOf(v.balance) < 0;
              return (
                <VaultLink key={v.id} asset={v.asset} className="pop flex flex-col rounded-card bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <AssetIcon asset={v.asset} size={30} />
                      <span className="min-w-0">
                        <span className="block font-extrabold">{v.asset}</span>
                        <span className="block truncate text-[11.5px] text-muted">{v.name} · {v.accountNumber}</span>
                      </span>
                    </span>
                    {negative ? <Badge tone="error">Negative</Badge> : signOf(v.balance) === 0 ? <Badge tone="warning">Empty</Badge> : null}
                  </div>
                  <div className="display num mt-4 truncate text-[22px] font-extrabold"><Money asset={v.asset} amount={v.balance} /></div>
                  <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
                    <span>Escrow <Money asset={v.asset} amount={e?.balance ?? "0"} /></span>
                    <span>In transit <Money asset={v.asset} amount={t?.balance ?? "0"} /></span>
                  </div>
                  <Suspense fallback={<Skeleton className="mt-3 h-[30px] w-full" />}>
                    <FreeToCredit asset={v.asset} />
                  </Suspense>
                </VaultLink>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** One /free-funds call (repo cache) shared by every card; the line is left out when the backend lacks it. */
async function FreeToCredit({ asset }: { asset: string }) {
  const free = (await listFreeFunds().catch(() => null))?.find((f) => f.asset === asset)?.free;
  if (free === undefined) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-line pt-2.5 text-[12px]">
      <span className="font-bold uppercase tracking-wider text-muted" title="Vault minus what customers are owed: the most admins can credit">Free to credit</span>
      <b className={signOf(free) > 0 ? "text-success-600 dark:text-success-300" : "text-error-600"}><Money asset={asset} amount={free} /></b>
    </div>
  );
}

async function Funding() {
  const [accounts, access] = await Promise.all([listInventory(), getAccess()]);
  const vaults = accounts.filter((a) => a.code === "company_vault").map((v) => ({ asset: v.asset as string, balance: v.balance }));
  return <FundingForm vaults={vaults} canRequest={access.has("inventory.topup")} />;
}

const viewer = (a: Access, decide: "inventory.approve" | "adjustments.approve"): InventoryViewer => ({
  id: a.admin.id, canDecide: a.has(decide), canSeeLedger: a.has("ledger.view"), superAdmin: isSuperAdmin(a.perms),
});

async function Fundings({ searchParams }: Pick<PageProps<"/inventory">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const params = { funding: str(sp, "funding"), fpage: str(sp, "fpage") };
  const initial = loadFundings(params);
  return <FundingsSection initial={initial} initialParams={params} me={viewer(await getAccess(), "inventory.approve")} />;
}

async function Adjustments({ searchParams }: Pick<PageProps<"/inventory">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const params = { adjustment: str(sp, "adjustment"), kind: str(sp, "kind"), apage: str(sp, "apage") };
  const initial = loadAdjustments(params);
  return <AdjustmentsSection initial={initial} initialParams={params} me={viewer(await getAccess(), "adjustments.approve")} />;
}

async function Entries({ searchParams }: Pick<PageProps<"/inventory">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const params = { asset: str(sp, "asset", 10), page: str(sp, "page") };
  const initial = loadEntries(params);
  const accounts = await listInventory().catch(() => []);
  const assets = [...new Set(accounts.filter((a) => a.code === "company_vault").map((a) => a.asset as string))];
  return <EntriesSection initial={initial} initialParams={params} assets={assets} />;
}
