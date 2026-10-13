import type { Metadata } from "next";
import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/customers/CustomerTable";
import { Icon } from "@/components/shell/icons";
import { Composer, MarkRead, ScrollToEnd, SimulatePanel, StatusButtons } from "@/components/support/SupportControls";
import { LegsButton } from "@/components/transactions/TxDrawer";
import { Badge, KycBadge, StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { hrefWith } from "@/components/ui/Pagination";
import { Empty, PageHeader } from "@/components/ui/Panel";
import { BrandLoader, Skeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { getThread, listThreads, type ThreadRow } from "@/lib/data/repo";
import { fmtDateTime, fmtMoney, fmtTime } from "@/lib/format";
import { oneOf, str, type SP } from "@/lib/params";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage({ searchParams }: PageProps<"/support">) {
  return (
    <>
      <PageHeader
        eyebrow="inbox"
        title="Support"
        subtitle="Tickets from the app and in-app chats, live. New ones chime and pop a toast on every page. Use the bell in the top bar to mute."
      />
      <Suspense fallback={null}>
        <SimulateIfAllowed />
      </Suspense>
      <Suspense fallback={<div className="card grid h-[560px] grid-cols-1 overflow-hidden lg:grid-cols-[380px_1fr]"><div className="space-y-px border-r-2 border-line">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex gap-3 p-4"><Skeleton className="size-10 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-full" /></div></div>)}</div><div className="hidden place-items-center bg-sunken lg:grid"><BrandLoader text="Opening the inbox…" /></div></div>}>
        <Gate perm="support.view"><Inbox searchParams={searchParams} /></Gate>
      </Suspense>
    </>
  );
}

const PRIORITY_TONE = { urgent: "error", high: "orange", normal: "neutral" } as const;

async function Inbox({ searchParams }: Pick<PageProps<"/support">, "searchParams">) {
  const sp = (await searchParams) as SP;
  const status = oneOf(sp, "status", ["open", "pending", "resolved"]);
  const channel = oneOf(sp, "channel", ["ticket", "chat"]);
  const selected = str(sp, "t", 40);
  const [{ rows, counts }, thread, access] = await Promise.all([listThreads({ status, channel }), selected ? getThread(selected) : Promise.resolve(null), getAccess()]);
  const base = { status, channel };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <LinkTabs
          label="Status"
          items={[
            { href: hrefWith("/support", { channel }, {}), label: "All", count: counts.all, active: !status },
            { href: hrefWith("/support", { channel }, { status: "open" }), label: "Open", count: counts.open, active: status === "open" },
            { href: hrefWith("/support", { channel }, { status: "pending" }), label: "Pending", count: counts.pending, active: status === "pending" },
            { href: hrefWith("/support", { channel }, { status: "resolved" }), label: "Resolved", count: counts.resolved, active: status === "resolved" },
          ]}
        />
        <LinkTabs
          label="Channel"
          items={[
            { href: hrefWith("/support", { status }, {}), label: "Everything", active: !channel },
            { href: hrefWith("/support", { status }, { channel: "ticket" }), label: "Tickets", active: channel === "ticket" },
            { href: hrefWith("/support", { status }, { channel: "chat" }), label: "In-app chat", active: channel === "chat" },
          ]}
        />
      </div>

      <div className="card grid h-[calc(100dvh-300px)] min-h-[560px] grid-cols-1 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Thread list: hidden on mobile while a conversation is open. */}
        <ul className={cx("min-h-0 overflow-y-auto border-edge lg:border-r-2", thread && "hidden lg:block")} data-lenis-prevent>
          {rows.length === 0 && <li><Empty title="Inbox zero" hint="Nothing here. Hit “New ticket” to simulate one." /></li>}
          {rows.map((r) => <ThreadItem key={r.id} r={r} active={r.id === selected} href={hrefWith("/support", base, { t: r.id })} />)}
        </ul>

        {thread ? (
          <section className="flex min-h-0 flex-col" aria-label="Conversation">
            <MarkRead threadId={thread.thread.id} unread={thread.thread.unread} />
            <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-edge bg-surface p-4">
              <div className="min-w-0">
                <Link href={hrefWith("/support", base, {})} className="link mb-2 inline-block text-[12px] lg:hidden">← All conversations</Link>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={thread.thread.channel === "ticket" ? "orange" : "blue"}>{thread.thread.channel === "ticket" ? "Ticket" : "In-app chat"}</Badge>
                  <StatusPill status={thread.thread.status} />
                  {thread.thread.priority !== "normal" && <Badge tone={PRIORITY_TONE[thread.thread.priority]}>{thread.thread.priority}</Badge>}
                  <span className="font-mono text-[12px] text-muted">{thread.thread.id}</span>
                </div>
                <h2 className="display mt-1.5 text-[24px] font-extrabold uppercase">{thread.thread.subject}</h2>
                {thread.customer && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
                    <Link href={`/customers/${thread.customer.id}`} className="link">{thread.customer.firstName} {thread.customer.lastName}</Link>
                    <span className="text-muted">@{thread.customer.tag}</span>
                    <KycBadge tier={thread.customer.kycTier} status={thread.customer.kycStatus} />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {access.has("support.resolve") && <StatusButtons threadId={thread.thread.id} status={thread.thread.status} />}
                {thread.tx && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Link href={`/transactions/${thread.tx.id}`} className="link font-mono">{thread.tx.reference}</Link>
                    <span className="num text-muted">{fmtMoney(thread.tx.source.asset, thread.tx.source.amount)}</span>
                    <StatusPill status={thread.tx.status} />
                    <LegsButton id={thread.tx.id} count={thread.tx.legCount} />
                  </div>
                )}
              </div>
            </header>
            <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-sunken p-4" data-lenis-prevent>
              {thread.thread.messages.map((m) =>
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
              <ScrollToEnd dep={thread.thread.messages.length} />
            </ol>
            {access.has("support.reply") ? (
              <Composer threadId={thread.thread.id} disabled={thread.thread.status === "resolved"} />
            ) : (
              <p className="flex items-center gap-2 border-t-2 border-edge bg-surface p-4 text-[12.5px] text-muted"><Icon name="lock" size={14} /> Read only: replying needs “Reply to customers”.</p>
            )}
          </section>
        ) : (
          <div className="hidden place-items-center bg-sunken lg:grid">
            <div className="text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full border-2 border-edge bg-warning-300 text-ink-900 shadow-hard"><Icon name="support" size={28} /></div>
              <p className="display text-[24px] font-extrabold uppercase">Pick a conversation</p>
              <p className="mt-1 text-[12.5px] text-muted">or simulate a new ticket to hear the chime 🔔</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadItem({ r, active, href }: { r: ThreadRow; active: boolean; href: string }) {
  const [first, ...rest] = r.customerName.split(" ");
  return (
    <li className="border-b-2 border-line">
      <Link
        href={href}
        scroll={false}
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
            <span className={cx("min-w-0 flex-1 truncate text-[12px]", r.unread ? "text-fg" : "text-muted")}>{r.previewFrom === "agent" ? "You: " : ""}{r.preview}</span>
            {r.priority !== "normal" && <span className={cx("size-2 shrink-0 rounded-full", r.priority === "urgent" ? "bg-error-500" : "bg-orange-500")} aria-label={`${r.priority} priority`} />}
            {r.unread > 0 && <span className="num grid min-w-5 shrink-0 place-items-center rounded-full border-2 border-edge bg-warning-300 px-1 text-[10.5px] font-extrabold text-ink-900">{r.unread}</span>}
            {r.status === "resolved" && <span className="shrink-0 text-[11px] font-bold text-success-600">✓</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

async function SimulateIfAllowed() {
  const a = await getAccess();
  if (!a.has("support.simulate")) return null;
  return (
    <div className="mb-5">
      <SimulatePanel />
    </div>
  );
}
