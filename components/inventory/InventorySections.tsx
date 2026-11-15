"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AdjustmentsTable } from "@/components/customers/AdjustmentsTable";
import { FundingDecision } from "@/components/inventory/FundingDecision";
import { StatusPill } from "@/components/ui/Badge";
import { ButtonTabs } from "@/components/ui/LinkTabs";
import { AssetIcon, Money } from "@/components/ui/Money";
import { PageButtons } from "@/components/ui/Pagination";
import { Empty } from "@/components/ui/Panel";
import { Picker } from "@/components/ui/Picker";
import { SectionBody } from "@/components/ui/Section";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { loadAdjustments, loadEntries, loadFundings } from "@/lib/actions/sections";
import { setUrlParams, useSection, type SectionParams, type SectionResult } from "@/lib/hooks/useSection";
import { fmtDateTime, fmtInt } from "@/lib/format";

// Inventory's three tables are independent sections: each owns its URL params
// (?funding & ?fpage, ?adjustment & ?kind & ?apage, ?asset & ?page), so a tab,
// filter or page change reloads that table alone and never resets the others.

type Data<F extends (p: unknown) => Promise<SectionResult<unknown>>> = Extract<Awaited<ReturnType<F>>, { ok: true }>["data"];
type Props<K extends string, F extends (p: unknown) => Promise<SectionResult<unknown>>> = { initial: ReturnType<F>; initialParams: SectionParams<K> };

const STATUSES = ["pending", "approved", "rejected", "all"] as const;
const tabLabel = (s: string) => (s === "all" ? "All" : s[0].toUpperCase() + s.slice(1));
const statusOf = (v?: string) => (STATUSES as readonly string[]).includes(v ?? "") ? v! : "pending";
const pageParam = (p: number) => (p > 1 ? String(p) : undefined);

export type InventoryViewer = { id: string; canDecide: boolean; canSeeLedger: boolean; superAdmin: boolean };

export function FundingsSection({ initial, initialParams, me, providerNames }: Props<"funding" | "fpage", typeof loadFundings> & { me: InventoryViewer; providerNames: Record<string, string> }) {
  const s = useSection({ initial, initialParams, load: loadFundings, urlKeys: ["funding", "fpage"] });
  const active = statusOf(s.params.funding);
  return (
    <div className="space-y-3">
      <ButtonTabs label="Funding status" items={STATUSES.map((v) => ({ value: v, label: tabLabel(v), active: active === v }))} onSelect={(v) => s.setParams({ funding: v === "pending" ? undefined : v, fpage: undefined })} />
      <SectionBody section={s} fallback={<TableSkeleton rows={6} />}>
        {(d) => <Fundings d={d} me={me} providerNames={providerNames} onPage={(p) => s.setParams({ fpage: pageParam(p) })} />}
      </SectionBody>
    </div>
  );
}

function Fundings({ d, me, providerNames, onPage }: { d: Data<typeof loadFundings>; me: InventoryViewer; providerNames: Record<string, string>; onPage: (p: number) => void }) {
  return (
    <div className="card overflow-hidden">
      {d.rows.length === 0 ? (
        <Empty title={d.status === "pending" ? "Nothing waiting for approval" : "No funding requests"} hint={d.status === "pending" ? "New requests appear here for a second admin to approve." : undefined} />
      ) : (
        <Table>
          <THead><Th>Requested</Th><Th>Provider vault</Th><Th className="text-right">Amount</Th><Th>Reference · note</Th><Th>Requested by</Th><Th>Status</Th><Th>Decided by</Th><Th className="text-right">{me.canDecide && d.status !== "approved" && d.status !== "rejected" ? "Decision" : "Journal"}</Th></THead>
          <tbody>
            {d.rows.map((f) => (
              <Tr key={f.id}>
                <Td className="num text-muted">{fmtDateTime(f.createdAt)}</Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 font-semibold"><AssetIcon asset={f.asset} size={16} />{f.asset}</span>
                  <div className="text-[12px] text-muted">{(f.providerId && providerNames[f.providerId]) || "Home provider"}</div>
                </Td>
                <Td className="text-right font-bold"><Money asset={f.asset} amount={f.amount} /></Td>
                <Td className="max-w-72">
                  <div className="truncate font-mono text-[12px]">{f.externalReference}</div>
                  {f.note && <div className="truncate text-[12px] text-muted">{f.note}</div>}
                </Td>
                <Td>{f.requestedByName}{f.requestedBy === me.id && <You />}</Td>
                <Td><StatusPill status={f.status === "rejected" ? "failed" : f.status} label={tabLabel(f.status)} /></Td>
                <Td className="max-w-56 text-[12.5px] text-muted">
                  {f.approvedByName ? <span className="block truncate">{f.approvedByName}{f.decidedAt ? ` · ${fmtDateTime(f.decidedAt)}` : ""}</span> : "—"}
                  {f.rejectionReason && <span className="block truncate text-error-600">{f.rejectionReason}</span>}
                </Td>
                <Td className="text-right">
                  {f.status === "pending" && me.canDecide ? (
                    <FundingDecision id={f.id} own={f.requestedBy === me.id} />
                  ) : f.journalEntryId ? (
                    <JournalRef id={f.journalEntryId} linked={me.canSeeLedger} />
                  ) : f.status === "pending" ? <span className="text-[12px] text-muted">Needs “Approve treasury funding”</span> : "—"}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {d.pages > 1 && <PageButtons {...d} onPage={onPage} />}
    </div>
  );
}

const KINDS = [{ value: "", label: "All" }, { value: "credit", label: "Credits" }, { value: "debit", label: "Debits" }];

export function AdjustmentsSection({ initial, initialParams, me }: Props<"adjustment" | "kind" | "apage", typeof loadAdjustments> & { me: InventoryViewer }) {
  const s = useSection({ initial, initialParams, load: loadAdjustments, urlKeys: ["adjustment", "kind", "apage"] });
  const active = statusOf(s.params.adjustment);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ButtonTabs label="Adjustment status" items={STATUSES.map((v) => ({ value: v, label: tabLabel(v), active: active === v }))} onSelect={(v) => s.setParams({ adjustment: v === "pending" ? undefined : v, apage: undefined })} />
        <Picker label="Type" value={s.params.kind ?? ""} options={KINDS} onChange={(v) => s.setParams({ kind: v || undefined, apage: undefined })} />
      </div>
      <SectionBody section={s} fallback={<TableSkeleton rows={6} />}>
        {(d) => (
          <div className="card overflow-hidden">
            {d.rows.length === 0 ? (
              <Empty title={d.status === "pending" ? "Nothing waiting for a super admin" : "No manual credits or debits"} hint={d.status === "pending" ? "Requests made from a customer's profile appear here." : undefined} />
            ) : (
              <AdjustmentsTable rows={d.rows} adminId={me.id} superAdmin={me.superAdmin} canDecide={me.canDecide} canSeeLedger={me.canSeeLedger} />
            )}
            {d.pages > 1 && <PageButtons {...d} onPage={(p) => s.setParams({ apage: pageParam(p) })} />}
          </div>
        )}
      </SectionBody>
    </div>
  );
}

export function EntriesSection({ initial, initialParams, assets }: Props<"asset" | "page", typeof loadEntries> & { assets: string[] }) {
  const s = useSection({ initial, initialParams, load: loadEntries, urlKeys: ["asset", "page"] });
  const filtered = !!(s.params.asset || s.params.page);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-line bg-sunken px-5 py-3">
        <Picker label="Asset" value={s.params.asset ?? ""} options={[{ value: "", label: "All" }, ...assets.map((a) => ({ value: a, label: a }))]} onChange={(v) => s.setParams({ asset: v || undefined, page: undefined })} />
        {filtered && (
          <button type="button" onClick={() => s.setParams({ asset: undefined, page: undefined })} className="press h-8 cursor-pointer rounded-full px-3 text-[12.5px] font-semibold text-orange-600 underline decoration-2 underline-offset-4 hover:text-orange-700 dark:text-orange-300">
            Clear filters
          </button>
        )}
      </div>
      <SectionBody section={s} fallback={<TableSkeleton rows={12} />}>
        {({ page: res }) =>
          !res ? (
            <Empty title="Not available yet" hint="The API doesn't serve vault movements (GET /admin-api/inventory/entries) on this backend yet." />
          ) : (
            <>
              <div className="border-b-2 border-line px-5 py-2.5 text-[12.5px] text-muted">{fmtInt(res.total)} legs on provider vaults</div>
              {res.rows.length === 0 ? (
                <Empty title="No provider vault movements" />
              ) : (
                <Table>
                  <THead><Th>Time</Th><Th>Vault</Th><Th>Memo</Th><Th className="text-right">In (debit)</Th><Th className="text-right">Out (credit)</Th><Th>Journal entry</Th></THead>
                  <tbody>
                    {res.rows.map((l) => (
                      <Tr key={l.id}>
                        <Td className="num text-muted">{fmtDateTime(l.createdAt)}</Td>
                        <Td><span className="inline-flex items-center gap-1.5 font-semibold"><AssetIcon asset={l.asset} size={16} />{l.accountName}</span></Td>
                        <Td className="max-w-72 truncate text-muted">{l.memo || "—"}</Td>
                        <Td className="text-right font-semibold">{l.side === "debit" ? <Money asset={l.asset} amount={l.amount} tone /> : <span className="text-muted/40">—</span>}</Td>
                        <Td className="text-right font-semibold">{l.side === "credit" ? <Money asset={l.asset} amount={`-${l.amount}`} tone /> : <span className="text-muted/40">—</span>}</Td>
                        <Td><Link href={`/ledger?entry=${l.journalEntryId}`} className="link font-mono text-[12px]">{l.journalEntryId.slice(0, 12)}…</Link></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <PageButtons {...res} onPage={(p) => s.setParams({ page: pageParam(p) })} />
            </>
          )
        }
      </SectionBody>
    </div>
  );
}

/** A vault card: filters the movements table to its asset in place (the href still deep-links). */
export function VaultLink({ asset, className, children }: { asset: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={`/inventory?asset=${encodeURIComponent(asset)}#entries`}
      data-section-link
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        setUrlParams({ asset, page: undefined });
        document.getElementById("entries")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}

function You() {
  return <span className="ml-1.5 rounded-full bg-orange-500 px-2 text-[10.5px] font-bold uppercase text-ink-900">you</span>;
}

function JournalRef({ id, linked }: { id: string; linked: boolean }) {
  return linked ? <Link href={`/ledger?entry=${id}`} className="link font-mono text-[12px]">{id.slice(0, 10)}…</Link> : <span className="font-mono text-[12px] text-muted">{id.slice(0, 10)}…</span>;
}
