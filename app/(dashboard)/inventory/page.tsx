import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { Suspense } from "react";
import { TopUpForm } from "@/components/inventory/TopUpForm";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { AssetIcon, Money } from "@/components/ui/Money";
import { Pagination } from "@/components/ui/Pagination";
import { Empty, PageHeader, Panel } from "@/components/ui/Panel";
import { ClearFilters, ParamPicker } from "@/components/ui/ParamControls";
import { CardsSkeleton, Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { getAccess } from "@/lib/auth/current";
import { listInventory, listInventoryEntries } from "@/lib/data/repo";
import { Icon, type IconName } from "@/components/shell/icons";
import { ASSETS, BOOKS } from "@/lib/domain/catalog";
import { fmtCompact, fmtDateTime, fmtInt, fmtMoney } from "@/lib/format";
import { flat, oneOf, pageOf, str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Inventory" };

const KIND_TONE = { topup: "purple", deduction: "error", credit: "success", adjustment: "warning" } as const;

export default function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  return (
    <>
      <PageHeader title="Inventory" subtitle="Naira lives in seven NGN books (Local, Fiat, Crypto, Virtual card, Utilities, Gift card, Cashpoint). Every conversion passes through a book, e.g. BTC → Crypto NGN · Fiat NGN → GBP. Add naira to any book except Cashpoint NGN." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Suspense fallback={<CardsSkeleton n={8} />}>
          <Gate perm="inventory.view"><Pools /></Gate>
        </Suspense>
        <Panel title="Top up an NGN book" className="order-first h-fit xl:sticky xl:top-24 xl:order-none">
          <Suspense fallback={<Skeleton className="h-72" />}>
            <Gate perm="inventory.view" compact><TopUp /></Gate>
          </Suspense>
        </Panel>
      </div>
      <div className="mt-10 scroll-mt-24" id="ledger">
        <h2 className="display mb-4 text-[28px] font-extrabold uppercase">Ledger</h2>
        <Suspense fallback={<TableSkeleton rows={12} />}>
          <Gate perm="inventory.view" compact><Ledger searchParams={searchParams} /></Gate>
        </Suspense>
      </div>
    </>
  );
}

async function Pools() {
  const pools = await listInventory();
  const books = pools.filter((p) => p.kind === "book");
  const assets = pools.filter((p) => p.kind === "asset");
  const groups = [
    { id: "crypto", label: "Crypto pools", blurb: "Crypto held for customers' wallets", items: assets.filter((p) => p.providerId === "crypto") },
    { id: "fiat", label: "Fiat pools", blurb: "FX accounts & mobile-money rails: settled by providers", items: assets.filter((p) => p.providerId !== "crypto") },
  ];
  const totalNgn = books.reduce((s, b) => s + b.balance, 0);
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="display text-[24px] font-extrabold uppercase">NGN books</h3>
          <span className="text-[12px] text-muted">Total <b className="num text-fg">{fmtMoney("NGN", totalNgn)}</b> · every conversion passes through one of these</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {books.map((p) => {
            const meta = BOOKS.find((b) => b.id === p.id)!;
            const ratio = p.lowThreshold ? p.balance / (p.lowThreshold * 4) : 1;
            const low = p.lowThreshold > 0 && p.balance < p.lowThreshold * 1.5;
            return (
              <Link key={p.id} href={`/inventory?pool=${encodeURIComponent(p.id)}#ledger`} scroll={false} className={cx("pop flex min-h-44 flex-col rounded-card p-4", low ? "bg-warning-300 text-ink-900" : !p.topup ? "bg-sunken" : "bg-surface")}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-edge bg-purple-500 text-white"><Icon name={meta.icon as IconName} size={16} /></span>
                    <span className="min-w-0">
                      <span className="block font-extrabold">{p.label}</span>
                      <span className={cx("block text-[11px] leading-snug", low ? "text-ink-700" : "text-muted")}>{meta.purpose}</span>
                    </span>
                  </span>
                  {low ? <Badge tone="error">Low</Badge> : !p.topup ? <Badge tone="neutral">Escrow</Badge> : null}
                </div>
                <div className="display num mt-auto truncate pt-4 text-[26px] font-extrabold">{fmtMoney("NGN", p.balance)}</div>
                {p.lowThreshold > 0 && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" aria-hidden>
                    <div className={cx("h-full rounded-full", low ? "bg-error-500" : "bg-purple-500")} style={{ width: `${Math.min(100, Math.max(3, ratio * 100))}%` }} />
                  </div>
                )}
                <div className={cx("mt-2 flex justify-between gap-2 text-[11px]", low ? "text-ink-700" : "text-muted")}>
                  <span>{p.lowThreshold ? `Min ${fmtMoney("NGN", p.lowThreshold)}` : "Holds open cashpoint codes"}</span>
                  <span>Out 7d {fmtMoney("NGN", p.out7d)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      {groups.map((g) => (
        <section key={g.id}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="display text-[24px] font-extrabold uppercase">{g.label}</h3>
            <span className="text-[12px] text-muted">{g.blurb}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {g.items.map((p) => {
              const low = p.lowThreshold > 0 && p.balance < p.lowThreshold * 1.5;
              return (
                <Link key={p.id} href={`/inventory?pool=${encodeURIComponent(p.id)}#ledger`} scroll={false} className="pop flex flex-col rounded-card bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <AssetIcon asset={p.asset} size={30} />
                      <span className="min-w-0">
                        <span className="block font-extrabold">{p.asset}</span>
                        <span className="block truncate text-[11.5px] text-muted">{p.providerId === "crypto" ? ASSETS[p.asset].name : p.provider}</span>
                      </span>
                    </span>
                    {low ? <Badge tone="error">Low</Badge> : <span className="num text-[12px] text-muted">${fmtCompact(p.usd)}</span>}
                  </div>
                  <div className="display num mt-4 truncate text-[22px] font-extrabold">{fmtMoney(p.asset, p.balance)}</div>
                  <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
                    <span>Min {fmtMoney(p.asset, p.lowThreshold)}</span>
                    <span>Out 7d {fmtMoney(p.asset, p.out7d)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

async function TopUp() {
  const [pools, access] = await Promise.all([listInventory(), getAccess()]);
  return <TopUpForm canEdit={access.has("inventory.topup")} books={pools.filter((p) => p.kind === "book").map((p) => ({ id: p.id, label: p.label, balance: p.balance, lowThreshold: p.lowThreshold, topup: p.topup }))} />;
}

async function Ledger({ searchParams }: Pick<PageProps<"/inventory">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const [pools, res] = await Promise.all([
    listInventory(),
    listInventoryEntries({ pool: str(sp, "pool", 60), kind: oneOf(sp, "kind", ["topup", "deduction", "credit", "adjustment"]), page: pageOf(sp) }),
  ]);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-line bg-sunken px-5 py-3">
        <span className="mr-2 text-[12.5px] text-muted">{fmtInt(res.total)} entries</span>
        <ParamPicker param="pool" label="Pool" options={pools.map((p) => ({ value: p.id, label: p.label }))} />
        <ParamPicker param="kind" label="Kind" options={[{ value: "topup", label: "Top-ups" }, { value: "deduction", label: "Deductions" }, { value: "credit", label: "Credits" }]} />
        <ClearFilters />
      </div>
      {res.rows.length === 0 ? <Empty title="No ledger entries" /> : (
        <Table>
          <THead><Th>Time</Th><Th>Pool</Th><Th>Kind</Th><Th className="text-right">Change</Th><Th className="text-right">Before</Th><Th className="text-right">After</Th><Th>Source</Th><Th>Note</Th></THead>
          <tbody>
            {res.rows.map((e) => (
              <Tr key={e.id}>
                <Td className="num text-muted">{fmtDateTime(e.at)}</Td>
                <Td className="font-semibold">{e.label}</Td>
                <Td><Badge tone={KIND_TONE[e.kind]}>{e.kind === "topup" ? "Top-up" : e.kind[0].toUpperCase() + e.kind.slice(1)}</Badge></Td>
                <Td className="text-right font-semibold"><Money asset={e.asset as never} amount={e.delta} sign tone /></Td>
                <Td className="text-right text-muted"><Money asset={e.asset as never} amount={e.before} /></Td>
                <Td className="text-right"><Money asset={e.asset as never} amount={e.after} /></Td>
                <Td className="text-[12.5px]">
                  {e.txId ? <Link href={`/transactions/${e.txId}`} className="font-mono link text-purple-700 dark:text-purple-200">{e.txRef ?? e.txId}</Link> : e.adminName ? <span>{e.adminName} · <span className="font-mono text-muted">{e.externalRef}</span></span> : "—"}
                </Td>
                <Td className="max-w-72 text-muted">
                  <span className="block truncate">{e.note ?? (e.kind === "topup" ? "Top-up" : "—")}</span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination path="/inventory" params={flat(sp, ["pool", "kind"])} {...res} />
    </div>
  );
}
