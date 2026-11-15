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
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { listFreeFunds, listInventory } from "@/lib/data/repo";
import { isSuperAdmin } from "@/lib/domain/permissions";
import type { LedgerAccount } from "@/lib/domain/types";
import { signOf } from "@/lib/format";
import { str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Inventory" };

// The providers hold the money; this page mirrors them. Every section streams
// on its own: the per-currency summary (/free-funds), one card per provider
// listing its currency vaults (/inventory), the funding form, and three
// client sections (fundings, adjustments, movements) that each own their URL
// params and reload alone. /inventory is read once per render (repo cache).

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <>
      <PageHeader title="Inventory" subtitle="The money sits with the providers: each one holds a vault per currency it handles. Per currency, what the providers hold minus what we owe customers is Tribe Funds, Tribe's own money: fees and margins go in, manual credits and referral rewards come out. Treasury funding needs two people: one admin records it, a different admin approves it before it's posted." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-8">
          <Suspense fallback={<TableSkeleton rows={6} />}>
            <Gate perm="inventory.view"><Currencies /></Gate>
          </Suspense>
          <Suspense fallback={<CardsSkeleton n={6} />}>
            <Gate perm="inventory.view"><Providers /></Gate>
          </Suspense>
        </div>
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
        <p className="mb-4 text-[13px] text-muted">Requested from a customer&apos;s profile. Only a super admin (not the requester) can approve. Credits come out of the currency&apos;s Tribe Funds (never another customer&apos;s money); debits go back into it, out of the customer&apos;s wallet.</p>
        <Suspense fallback={<TabbedSkeleton rows={6} />}>
          <Gate perm="inventory.view" compact><Adjustments searchParams={searchParams} /></Gate>
        </Suspense>
      </div>
      <div className="mt-10 scroll-mt-24" id="entries">
        <h2 className="display mb-4 text-[28px] font-extrabold uppercase">Provider vault movements</h2>
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

/** Per currency: what every provider holds, what we owe customers, and Tribe Funds (always vaults − owed). */
async function Currencies() {
  const funds = await listFreeFunds();
  if (!funds) return <div className="card"><Empty title="Not available yet" hint="This backend doesn't serve GET /admin-api/free-funds yet." /></div>;
  return (
    <section>
      <h3 className="display mb-3 text-[24px] font-extrabold uppercase">By currency</h3>
      <div className="card overflow-hidden">
        <Table>
          <THead><Th>Currency</Th><Th className="text-right">Held by providers</Th><Th className="text-right">Owed to customers</Th><Th className="text-right">Tribe Funds</Th></THead>
          <tbody>
            {funds.map((f) => {
              const broken = f.free !== f.tribeFunds;
              return (
                <Tr key={f.asset}>
                  <Td><span className="inline-flex items-center gap-2 font-semibold"><AssetIcon asset={f.asset} size={18} />{f.asset}</span></Td>
                  <Td className="text-right"><Money asset={f.asset} amount={f.vaults} /></Td>
                  <Td className="text-right text-muted"><Money asset={f.asset} amount={f.owed} /></Td>
                  <Td className="text-right">
                    <span className="inline-flex items-center gap-2">
                      {broken && <Badge tone="error">≠ vaults − owed</Badge>}
                      {signOf(f.tribeFunds) < 0 && <Badge tone="warning">Fund it</Badge>}
                      <b><Money asset={f.asset} amount={f.tribeFunds} tone /></b>
                    </span>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      <p className="mt-2 text-[12px] text-muted">Tribe Funds is the most admins can credit customers, and where referral rewards are paid from. Negative means Tribe owes more than the providers hold for it: record treasury funding.</p>
    </section>
  );
}

const CATEGORY_LABEL: Record<string, string> = { global: "Fiat", crypto: "Crypto", utilities: "Bills", gift_card: "Gift cards", virtual_card: "Cards" };

/** One card per provider, listing the vault it holds for each currency it handles. */
async function Providers() {
  const accounts = await listInventory();
  const vaults = accounts.filter((a) => a.code === "provider_vault");
  if (!vaults.length) return <div className="card"><Empty title="No provider vaults" hint="Run the seeder: it opens a vault for every currency each provider handles." /></div>;
  const byProvider = new Map<string, LedgerAccount[]>();
  for (const v of vaults) byProvider.set(v.providerId ?? v.ownerKey, [...(byProvider.get(v.providerId ?? v.ownerKey) ?? []), v]);
  return (
    <section>
      <h3 className="display mb-3 text-[24px] font-extrabold uppercase">Provider vaults</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...byProvider.values()].map((list) => {
          const p = list[0];
          return (
            <div key={p.providerId ?? p.ownerKey} className="pop flex flex-col rounded-card bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-extrabold">{p.providerName ?? p.ownerKey}</span>
                  <span className="block text-[11.5px] text-muted">{CATEGORY_LABEL[p.providerCategory ?? ""] ?? p.providerCategory} · {list.length} {list.length === 1 ? "currency" : "currencies"}</span>
                </span>
                {p.providerSimulator && <Badge tone="warning">Simulator</Badge>}
              </div>
              <ul className="mt-3 divide-y-2 divide-line">
                {list.map((v) => (
                  <li key={v.id}>
                    <VaultLink asset={v.asset} className="flex items-center justify-between gap-3 py-2 hover:text-orange-600">
                      <span className="flex min-w-0 items-center gap-2">
                        <AssetIcon asset={v.asset} size={22} />
                        <span className="min-w-0">
                          <span className="block font-semibold">{v.asset}</span>
                          <span className="block truncate font-mono text-[11px] text-muted">{v.accountNumber}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {signOf(v.balance) < 0 && <Badge tone="error">Overdrawn</Badge>}
                        <b className="num"><Money asset={v.asset} amount={v.balance} /></b>
                      </span>
                    </VaultLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function Funding() {
  const [accounts, access] = await Promise.all([listInventory(), getAccess()]);
  const vaults = accounts
    .filter((a) => a.code === "provider_vault" && a.providerId)
    .map((v) => ({ providerId: v.providerId!, providerName: v.providerName ?? "", asset: v.asset as string, balance: v.balance }));
  return <FundingForm vaults={vaults} canRequest={access.has("inventory.topup")} />;
}

const viewer = (a: Access, decide: "inventory.approve" | "adjustments.approve"): InventoryViewer => ({
  id: a.admin.id, canDecide: a.has(decide), canSeeLedger: a.has("ledger.view"), superAdmin: isSuperAdmin(a.perms),
});

async function Fundings({ searchParams }: Pick<PageProps<"/inventory">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const params = { funding: str(sp, "funding"), fpage: str(sp, "fpage") };
  const initial = loadFundings(params);
  const accounts = await listInventory().catch(() => []);
  const providerNames = Object.fromEntries(accounts.filter((a) => a.providerId).map((a) => [a.providerId!, a.providerName ?? ""]));
  return <FundingsSection initial={initial} initialParams={params} me={viewer(await getAccess(), "inventory.approve")} providerNames={providerNames} />;
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
  const assets = [...new Set(accounts.filter((a) => a.code === "provider_vault").map((a) => a.asset as string))];
  return <EntriesSection initial={initial} initialParams={params} assets={assets} />;
}
