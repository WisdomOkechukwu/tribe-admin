"use client";

import Link from "next/link";
import { Suspense, use, useState } from "react";
import { Avatar } from "@/components/customers/CustomerTable";
import { Icon } from "@/components/shell/icons";
import { Composer, ScrollToEnd, StatusButtons } from "@/components/support/SupportControls";
import { LegsButton } from "@/components/transactions/TxDrawer";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { ButtonTabs, TabCount } from "@/components/ui/LinkTabs";
import { Empty } from "@/components/ui/Panel";
import { SectionBody, SectionError, Streamed } from "@/components/ui/Section";
import { BrandLoader, Skeleton } from "@/components/ui/Skeleton";
import { loadThread } from "@/lib/actions/sections";
import type { SupportThread } from "@/lib/domain/types";
import { setUrlParams, useSection, type SectionParams, type SectionResult } from "@/lib/hooks/useSection";
import { fmtDateTime, fmtMoney, fmtTime } from "@/lib/format";

type ThreadList = { rows: SupportThread[]; counts: Record<string, number> };
type Filter = { status?: string; channel?: string };

const STATUS_TABS = [{ v: "", l: "All", c: "all" }, { v: "open", l: "Open", c: "open" }, { v: "pending", l: "Pending", c: "pending" }, { v: "resolved", l: "Resolved", c: "resolved" }];
const CHANNEL_TABS = [{ v: "", l: "Everything" }, { v: "ticket", l: "Tickets" }, { v: "chat", l: "In-app chat" }];
const PRIORITY_TONE = { urgent: "error", high: "orange", normal: "neutral" } as const;

/**
 * The inbox: the thread list and the open conversation stream in separately.
 * Status / channel tabs filter the loaded list in the browser (?status,
 * ?channel); picking a thread loads only that thread (?t). A reply, a status
 * change or a live event refreshes the route, and both re-sync.
 */
export function SupportInbox({ list, thread: initialThread, initialParams, canResolve, canReply }: {
  list: Promise<SectionResult<ThreadList>>;
  thread: ReturnType<typeof loadThread>;
  initialParams: SectionParams<"status" | "channel" | "t">;
  canResolve: boolean;
  canReply: boolean;
}) {
  const [filter, setFilter] = useState<Filter>({ status: initialParams.status, channel: initialParams.channel });
  // a server render (a link to /support?status=…, a refresh) carries the URL's filter
  const [seen, setSeen] = useState(list);
  if (seen !== list) {
    setSeen(list);
    setFilter({ status: initialParams.status, channel: initialParams.channel });
  }
  const thread = useSection({ initial: initialThread, initialParams: { t: initialParams.t }, load: loadThread, urlKeys: ["t"] });
  const selected = thread.params.t;
  const filterBy = (patch: Filter) => {
    setFilter((f) => ({ ...f, ...patch }));
    setUrlParams(patch);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ButtonTabs
          label="Status"
          onSelect={(v) => filterBy({ status: v || undefined })}
          items={STATUS_TABS.map((t) => ({
            value: t.v, label: t.l, active: (filter.status ?? "") === t.v,
            count: <Streamed value={list} fallback={<Skeleton className="h-4 w-6 rounded-full" />}>{(r) => (r.ok ? <TabCount n={r.data.counts[t.c] ?? 0} active={(filter.status ?? "") === t.v} /> : null)}</Streamed>,
          }))}
        />
        <ButtonTabs label="Channel" onSelect={(v) => filterBy({ channel: v || undefined })} items={CHANNEL_TABS.map((t) => ({ value: t.v, label: t.l, active: (filter.channel ?? "") === t.v }))} />
      </div>

      <div className="card grid h-[calc(100dvh-300px)] min-h-[560px] grid-cols-1 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Thread list: hidden on mobile while a conversation is open. */}
        <ul className={cx("min-h-0 overflow-y-auto border-edge lg:border-r-2", selected && "hidden lg:block")} data-lenis-prevent>
          <Suspense fallback={<ListSkeleton />}>
            <Threads list={list} filter={filter} selected={selected} onSelect={(id) => thread.setParams({ t: id })} />
          </Suspense>
        </ul>

        <SectionBody section={thread} className={cx("min-h-0", !selected && "hidden lg:block")} bodyClass="flex h-full min-h-0 flex-col" fallback={<div className="grid h-full place-items-center bg-sunken"><BrandLoader text="Opening the conversation…" /></div>}>
          {(d) => (d ? <Conversation d={d} canResolve={canResolve} canReply={canReply} onClose={() => thread.setParams({ t: undefined })} /> : <Pick />)}
        </SectionBody>
      </div>
    </div>
  );
}

function Threads({ list, filter, selected, onSelect }: { list: Promise<SectionResult<ThreadList>>; filter: Filter; selected?: string; onSelect: (id: string) => void }) {
  const r = use(list);
  if (!r.ok) return <li><SectionError message={r.message} /></li>;
  const rows = r.data.rows.filter((t) => (!filter.status || t.status === filter.status) && (!filter.channel || t.channel === filter.channel));
  if (rows.length === 0) return <li><Empty title="Inbox zero" hint="Nothing here. New tickets from the app appear live." /></li>;
  return rows.map((t) => <ThreadItem key={t.id} r={t} active={t.id === selected} onSelect={onSelect} />);
}

function ThreadItem({ r, active, onSelect }: { r: SupportThread; active: boolean; onSelect: (id: string) => void }) {
  const [first, ...rest] = r.customerName.split(" ");
  return (
    <li className="border-b-2 border-line">
      <a
        href={`/support?t=${encodeURIComponent(r.id)}`}
        data-section-link
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          if (!active) onSelect(r.id);
        }}
        aria-current={active ? "true" : undefined}
        className={cx("flex gap-3 px-4 py-3 transition-colors", active ? "bg-orange-100 dark:bg-orange-900/40" : "hover:bg-purple-50/70 dark:hover:bg-purple-900/20")}
      >
        <Avatar c={{ firstName: first ?? "", lastName: rest.join(" ") }} size={38} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cx("truncate", r.unread ? "font-extrabold" : "font-semibold")}>{r.customerName}</span>
            <Icon name={r.channel === "ticket" ? "ticket" : "support"} size={13} className="shrink-0 text-muted" aria-label={r.channel} />
            <span className="num ml-auto shrink-0 text-[11px] text-muted">{fmtTime(r.updatedAt)}</span>
          </span>
          <span className="block truncate text-[12.5px] font-semibold">{r.subject}</span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cx("min-w-0 flex-1 truncate text-[12px]", r.unread ? "text-fg" : "text-muted")}>{r.preview || r.subject}</span>
            {r.priority !== "normal" && <span className={cx("size-2 shrink-0 rounded-full", r.priority === "urgent" ? "bg-error-500" : "bg-orange-500")} aria-label={`${r.priority} priority`} />}
            {r.unread > 0 && <span className="num grid min-w-5 shrink-0 place-items-center rounded-full border-2 border-edge bg-warning-300 px-1 text-[10.5px] font-extrabold text-ink-900">{r.unread}</span>}
            {r.status === "resolved" && <span className="shrink-0 text-[11px] font-bold text-success-600">✓</span>}
          </span>
        </span>
      </a>
    </li>
  );
}

type ThreadData = NonNullable<Extract<Awaited<ReturnType<typeof loadThread>>, { ok: true }>["data"]>;

function Conversation({ d, canResolve, canReply, onClose }: { d: ThreadData; canResolve: boolean; canReply: boolean; onClose: () => void }) {
  const { thread, messages, tx } = d;
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Conversation">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-edge bg-surface p-4">
        <div className="min-w-0">
          <button type="button" onClick={onClose} className="link mb-2 inline-block cursor-pointer text-[12px] lg:hidden">← All conversations</button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={thread.channel === "ticket" ? "orange" : "blue"}>{thread.channel === "ticket" ? "Ticket" : "In-app chat"}</Badge>
            <StatusPill status={thread.status} />
            {thread.priority !== "normal" && <Badge tone={PRIORITY_TONE[thread.priority]}>{thread.priority}</Badge>}
            <span className="font-mono text-[12px] text-muted">{thread.id}</span>
          </div>
          <h2 className="display mt-1.5 text-[24px] font-extrabold uppercase">{thread.subject}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
            <Link href={`/customers/${thread.customerId}`} className="link">{thread.customerName}</Link>
            {thread.customerTag && <span className="text-muted">@{thread.customerTag}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canResolve && <StatusButtons threadId={thread.id} status={thread.status} />}
          {tx && (
            <div className="flex items-center gap-2 text-[12px]">
              <Link href={`/transactions/${tx.id}`} className="link font-mono">{tx.reference}</Link>
              <span className="num text-muted">{fmtMoney(tx.source.asset, tx.source.amount)}</span>
              <StatusPill status={tx.status} />
              <LegsButton id={tx.id} />
            </div>
          )}
        </div>
      </header>
      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-sunken p-4" data-lenis-prevent>
        {messages.map((m) =>
          m.from === "system" ? (
            <li key={m.id} className="text-center text-[11.5px] text-muted">
              <span className="rounded-full border-2 border-dashed border-line bg-surface px-3 py-1">{m.body} · {fmtTime(m.at)}</span>
            </li>
          ) : (
            <li key={m.id} className={cx("flex", m.from === "agent" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[78%] rounded-card border-2 border-edge px-3.5 py-2.5", m.from === "agent" ? "rounded-br-[6px] bg-purple-500 text-white" : "rounded-bl-[6px] bg-surface")}>
                <div className={cx("mb-0.5 text-[11px] font-bold", m.from === "agent" ? "text-purple-100" : "text-purple-600 dark:text-purple-200")}>{m.author}{m.from === "agent" ? " · Tribe support" : ""}</div>
                <p className="text-[13.5px] whitespace-pre-wrap break-words">{m.body}</p>
                <div className={cx("mt-1 text-right text-[10.5px]", m.from === "agent" ? "text-purple-100" : "text-muted")}>{fmtDateTime(m.at)}</div>
              </div>
            </li>
          ),
        )}
        <ScrollToEnd dep={messages.length} />
      </ol>
      {canReply ? (
        <Composer key={thread.id} threadId={thread.id} disabled={thread.status === "resolved"} />
      ) : (
        <p className="flex items-center gap-2 border-t-2 border-edge bg-surface p-4 text-[12.5px] text-muted"><Icon name="lock" size={14} /> Read only: replying needs “Reply to customers”.</p>
      )}
    </section>
  );
}

function Pick() {
  return (
    <div className="hidden h-full place-items-center bg-sunken lg:grid">
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full border-2 border-edge bg-warning-300 text-ink-900 shadow-hard"><Icon name="support" size={28} /></div>
        <p className="display text-[24px] font-extrabold uppercase">Pick a conversation</p>
        <p className="mt-1 text-[12.5px] text-muted">new tickets chime as they arrive 🔔</p>
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return Array.from({ length: 6 }, (_, i) => (
    <li key={i} className="flex gap-3 p-4" aria-hidden>
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-full" /></div>
    </li>
  ));
}
