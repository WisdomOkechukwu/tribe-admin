"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LegsTable } from "@/components/transactions/LegTimeline";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AssetIcon, Money } from "@/components/ui/Money";
import { PageButtons } from "@/components/ui/Pagination";
import { Empty, Facts, Panel } from "@/components/ui/Panel";
import { Picker } from "@/components/ui/Picker";
import { SectionBody } from "@/components/ui/Section";
import { PanelSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Toolbar } from "@/components/ui/Toolbar";
import { loadAccountLegs, loadJournalEntry, loadLedgerAccounts } from "@/lib/actions/sections";
import { ASSET_CODES } from "@/lib/domain/catalog";
import { setUrlParams, useSection, type SectionParams } from "@/lib/hooks/useSection";
import { fmtDateTime, fmtInt } from "@/lib/format";

// The ledger's accounts view is three sections: the open journal entry
// (?entry), the account list (?owner, ?asset) and the picked account's legs
// (?account, ?page). Opening an entry, filtering or picking an account reloads
// only the section it belongs to.

const plainClick = (e: React.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** The entry lookup box plus the open journal entry. */
export function EntrySection({ initial, initialParams }: { initial: ReturnType<typeof loadJournalEntry>; initialParams: SectionParams<"entry"> }) {
  const s = useSection({ initial, initialParams, load: loadJournalEntry, urlKeys: ["entry"] });
  const [text, setText] = useState(initialParams.entry ?? "");
  // follow an entry opened from elsewhere on the page (a leg's link)
  const [shown, setShown] = useState(s.params.entry);
  if (shown !== s.params.entry) {
    setShown(s.params.entry);
    setText(s.params.entry ?? "");
  }
  const open = (id?: string) => s.setParams({ entry: id || undefined });
  return (
    <div className="space-y-6">
      <form className="flex w-full max-w-md items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) open(text.trim()); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Journal entry ID" aria-label="Journal entry ID" maxLength={40} className="h-9 min-w-0 flex-1 rounded-full border-2 border-edge bg-surface px-4 font-mono text-[12.5px] outline-none focus:border-purple-500 focus-visible:outline-none" />
        <Button type="submit" size="sm" variant="ink" disabled={s.pending || !text.trim()}>{s.pending ? "Opening…" : "Open entry"}</Button>
      </form>
      {s.params.entry && (
        <SectionBody section={s} fallback={<PanelSkeleton />}>
          {(d) => (d && d.id === s.params.entry ? <Entry d={d} onOpen={open} /> : <PanelSkeleton />)}
        </SectionBody>
      )}
    </div>
  );
}

type EntryData = NonNullable<Extract<Awaited<ReturnType<typeof loadJournalEntry>>, { ok: true }>["data"]>;

function Entry({ d, onOpen }: { d: EntryData; onOpen: (id?: string) => void }) {
  const close = <button type="button" onClick={() => onOpen(undefined)} className="link cursor-pointer text-[12.5px]">Close</button>;
  if (!d.entry) return <Panel title="Journal entry" action={close}><Empty title="No journal entry with that ID" /></Panel>;
  const { entry, legs } = d.entry;
  return (
    <Panel title={<span className="flex items-center gap-2">Journal entry <Badge tone="purple">{entry.transactionType}</Badge></span>} action={close}>
      <div className="space-y-4">
        <Facts
          cols={3}
          items={[
            ["Reference", <span key="r" className="font-mono text-[12.5px] break-all">{entry.reference}</span>],
            ["Description", entry.description || "—"],
            ["Status", <StatusPill key="s" status={entry.status === "posted" ? "completed" : entry.status} label={entry.status} />],
            ["Posted", fmtDateTime(entry.postedAt)],
            ["Created by", <span key="c" className="font-mono text-[12px]">{entry.createdBy}</span>],
            ["Transaction", entry.businessTransactionId ? <Link key="t" href={`/transactions/${entry.businessTransactionId}`} className="link font-mono text-[12px]">{entry.businessTransactionId}</Link> : "—"],
            ...(entry.reversesEntryId ? [["Reverses", <button key="v" type="button" onClick={() => onOpen(entry.reversesEntryId)} className="link cursor-pointer font-mono text-[12px]">{entry.reversesEntryId}</button>] as [string, React.ReactNode]] : []),
          ]}
        />
        <LegsTable legs={legs} />
      </div>
    </Panel>
  );
}

/** Account list (filtered by owner and asset) beside the picked account's legs. */
export function AccountsBrowser({ accounts: accountsInitial, legs: legsInitial, initialParams }: {
  accounts: ReturnType<typeof loadLedgerAccounts>;
  legs: ReturnType<typeof loadAccountLegs>;
  initialParams: SectionParams<"owner" | "asset" | "account" | "page">;
}) {
  const accounts = useSection({ initial: accountsInitial, initialParams: { owner: initialParams.owner, asset: initialParams.asset }, load: loadLedgerAccounts, urlKeys: ["owner", "asset"] });
  const legs = useSection({ initial: legsInitial, initialParams: { account: initialParams.account, page: initialParams.page }, load: loadAccountLegs, urlKeys: ["account", "page"] });
  const [searchKey, setSearchKey] = useState(0);
  const selected = Number(legs.params.account);
  const filtered = !!(accounts.params.owner || accounts.params.asset);

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card overflow-hidden">
        <Toolbar className="px-5 py-3">
          <OwnerSearch key={searchKey} initial={accounts.params.owner} pending={accounts.pending} onSearch={(owner) => accounts.setParams({ owner })} />
          <Picker label="Asset" value={accounts.params.asset ?? ""} options={[{ value: "", label: "All" }, ...ASSET_CODES.map((a) => ({ value: a, label: a }))]} onChange={(v) => accounts.setParams({ asset: v || undefined })} />
          {filtered && (
            <button type="button" onClick={() => { setSearchKey((k) => k + 1); accounts.setParams({ owner: undefined, asset: undefined }); }} className="press h-8 cursor-pointer rounded-full px-3 text-[12.5px] font-semibold text-orange-600 underline decoration-2 underline-offset-4 hover:text-orange-700 dark:text-orange-300">
              Clear filters
            </button>
          )}
        </Toolbar>
        <SectionBody section={accounts} fallback={<TableSkeleton rows={12} />}>
          {(d) => (
            <>
              <div className="border-y-2 border-line bg-sunken px-5 py-2.5 text-[12.5px] text-muted"><b className="num text-fg">{fmtInt(d.rows.length)}</b> {d.owner === "company" ? "company" : "customer"} accounts</div>
              {d.rows.length === 0 ? <Empty title="No accounts" hint="Try another owner or asset." /> : (
                <Table>
                  <THead><Th>Account</Th><Th>Code</Th><Th>Category</Th><Th className="text-right">Balance</Th></THead>
                  <tbody>
                    {d.rows.map((a) => (
                      <Tr key={a.id} className={a.id === selected ? "bg-orange-100 dark:bg-orange-900/40" : undefined}>
                        <Td>
                          <a
                            href={`/ledger?account=${a.id}`}
                            data-section-link
                            onClick={(e) => { if (!plainClick(e)) return; e.preventDefault(); legs.setParams({ account: String(a.id), page: undefined }); }}
                            className="inline-flex items-center gap-2"
                          >
                            <AssetIcon asset={a.asset} size={18} />
                            <span className="min-w-0 leading-tight">
                              <span className="link block font-semibold">{a.name}</span>
                              <span className="block font-mono text-[11px] text-muted">{a.accountNumber} · #{a.id}</span>
                            </span>
                          </a>
                        </Td>
                        <Td className="font-mono text-[12px] text-muted">{a.code}</Td>
                        <Td><Badge tone={a.category === "asset" ? "blue" : a.category === "revenue" ? "success" : a.category === "equity" ? "orange" : "purple"}>{a.category.replace(/_/g, " ")}</Badge> <span className="text-[11px] text-muted">{a.normalSide}</span></Td>
                        <Td className="text-right font-semibold"><Money asset={a.asset} amount={a.balance} tone={a.balance.startsWith("-")} /></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </SectionBody>
      </div>

      {legs.params.account ? (
        <SectionBody section={legs} fallback={<TableSkeleton rows={10} />}>
          {(d) => (d && String(d.id) === legs.params.account ? <Legs d={d} onPage={(p) => legs.setParams({ page: p > 1 ? String(p) : undefined })} /> : <TableSkeleton rows={10} />)}
        </SectionBody>
      ) : (
        <div className="hidden place-items-center rounded-card border-2 border-dashed border-line p-10 text-center text-[13px] text-muted 2xl:grid">Pick an account to see its legs.</div>
      )}
    </div>
  );
}

type LegsData = NonNullable<Extract<Awaited<ReturnType<typeof loadAccountLegs>>, { ok: true }>["data"]>;

function Legs({ d, onPage }: { d: LegsData; onPage: (p: number) => void }) {
  const name = d.rows[0]?.accountName ?? `Account #${d.id}`;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line px-5 py-3">
        <h2 className="display text-[19px] font-bold uppercase">{name}</h2>
        <span className="text-[12px] text-muted">{fmtInt(d.total)} legs · newest first</span>
      </div>
      {d.rows.length === 0 ? <Empty title="No legs on this account yet" /> : (
        <Table>
          <THead><Th>Time</Th><Th>Memo</Th><Th className="text-right">Debit</Th><Th className="text-right">Credit</Th><Th>Entry</Th></THead>
          <tbody>
            {d.rows.map((l) => (
              <Tr key={l.id}>
                <Td className="num text-muted">{fmtDateTime(l.createdAt)}</Td>
                <Td className="max-w-64 truncate">{l.memo || "—"}</Td>
                <Td className="text-right font-semibold">{l.side === "debit" ? <Money asset={l.asset} amount={l.amount} /> : <span className="text-muted/40">—</span>}</Td>
                <Td className="text-right font-semibold">{l.side === "credit" ? <Money asset={l.asset} amount={l.amount} /> : <span className="text-muted/40">—</span>}</Td>
                <Td>
                  <a
                    href={`/ledger?entry=${l.journalEntryId}`}
                    data-section-link
                    onClick={(e) => { if (!plainClick(e)) return; e.preventDefault(); setUrlParams({ entry: l.journalEntryId }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="link font-mono text-[12px]"
                  >
                    {l.journalEntryId.slice(0, 12)}…
                  </a>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <PageButtons {...d} onPage={onPage} />
    </div>
  );
}

/** Owner filter: debounced, so typing never blocks and only the account list reloads. */
function OwnerSearch({ initial, pending, onSearch }: { initial?: string; pending: boolean; onSearch: (owner: string | undefined) => void }) {
  const [value, setValue] = useState(initial ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const send = (v: string) => {
    clearTimeout(timer.current);
    onSearch(v.trim() || undefined);
  };
  return (
    <label className="relative flex h-8 w-full items-center rounded-full border-2 border-edge bg-surface focus-within:border-purple-500 sm:w-72">
      <input
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => send(v), 280);
        }}
        onKeyDown={(e) => e.key === "Enter" && send(value)}
        placeholder="Owner: company or a customer ID"
        aria-label="Owner: company or a customer ID"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-[12.5px] outline-none placeholder:text-muted focus-visible:outline-none"
      />
      {pending && <span className="mr-2.5 size-3 shrink-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" aria-label="Loading" />}
    </label>
  );
}
