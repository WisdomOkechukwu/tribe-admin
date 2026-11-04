import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { RetryButton, RunSnapshotButton } from "@/components/jobs/JobActions";
import { StatusPill } from "@/components/ui/Badge";
import { Empty, PageHeader, Panel, Stat } from "@/components/ui/Panel";
import { CardsSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { settle } from "@/lib/api/client";
import { getAccess } from "@/lib/auth/current";
import { listCronRuns, listFailedJobs, listJobSchedule, listQueues } from "@/lib/data/repo";
import { fmtDateTime, fmtInt } from "@/lib/format";

export const metadata: Metadata = { title: "Jobs" };

// Runs, queues, failed jobs and the schedule each stream from their own
// endpoint; the tiles reuse those same reads (repo cache: one call each).

export default function JobsPage() {
  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="The scheduler's cron runs and the worker's queues: what ran, what's waiting and what failed. Failed queue jobs can be put back on their queue."
        actions={<Suspense fallback={null}><SnapshotIfAllowed /></Suspense>}
      />
      <Suspense fallback={<div className="space-y-6"><CardsSkeleton /><RowsSkeleton rows={8} /></div>}>
        <Gate perm="jobs.view">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Suspense fallback={<TileSkeletons n={3} />}><QueueTiles /></Suspense>
              <Suspense fallback={<TileSkeletons n={1} />}><CronTile /></Suspense>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel title="Queues" bodyClass="p-0"><Suspense fallback={<RowsSkeleton rows={4} />}><Queues /></Suspense></Panel>
              <Panel title="Schedule" bodyClass="p-0"><Suspense fallback={<RowsSkeleton rows={4} />}><Schedule /></Suspense></Panel>
            </div>
            <Panel title="Failed queue jobs" action={<Suspense fallback={null}><FailedCount /></Suspense>} bodyClass="p-0"><Suspense fallback={<RowsSkeleton rows={3} />}><FailedJobs /></Suspense></Panel>
            <Panel title="Cron runs" bodyClass="p-0"><Suspense fallback={<RowsSkeleton rows={8} />}><CronRuns /></Suspense></Panel>
          </div>
        </Gate>
      </Suspense>
    </>
  );
}

async function SnapshotIfAllowed() {
  const a = await getAccess();
  return a.has("jobs.manage") ? <RunSnapshotButton /> : null;
}

const duration = (start: string, end: string | null) => {
  if (!end) return "running";
  const ms = Date.parse(end) - Date.parse(start);
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

const Failed = ({ message }: { message: string }) => <Empty title="Couldn't load this" hint={message} />;

async function QueueTiles() {
  const r = await settle(listQueues);
  const total = (k: "pending" | "active" | "retry" | "failed") => (r.ok ? r.data.reduce((s, q) => s + q[k], 0) : 0);
  const v = (n: number) => (r.ok ? fmtInt(n) : "—");
  return (
    <>
      <Stat color="purple" label="Pending" value={v(total("pending"))} sub={r.ok ? `${fmtInt(total("active"))} running now` : "couldn't load"} />
      <Stat color="yellow" label="Retrying" value={v(total("retry"))} />
      <Stat color="orange" label="Failed" value={v(total("failed"))} sub={r.ok ? (total("failed") ? "needs a look" : "all clear") : undefined} />
    </>
  );
}

async function CronTile() {
  const [schedule, runs] = await Promise.all([settle(listJobSchedule), settle(listCronRuns)]);
  return <Stat color="ink" label="Cron jobs" value={schedule.ok ? fmtInt(schedule.data.length) : "—"} sub={runs.ok ? `${fmtInt(runs.data.length)} recent runs` : undefined} />;
}

async function Queues() {
  const r = await settle(listQueues);
  if (!r.ok) return <Failed message={r.message} />;
  return r.data.length === 0 ? <Empty title="No queues yet" hint="A queue appears after its first job." /> : (
    <Table>
      <THead><Th>Queue</Th><Th className="text-right">Pending</Th><Th className="text-right">Active</Th><Th className="text-right">Scheduled</Th><Th className="text-right">Retry</Th><Th className="text-right">Failed</Th><Th className="text-right">Done today</Th></THead>
      <tbody>
        {r.data.map((q) => (
          <Tr key={q.name}>
            <Td className="font-mono font-semibold">{q.name}</Td>
            <Td className="num text-right">{fmtInt(q.pending)}</Td>
            <Td className="num text-right">{fmtInt(q.active)}</Td>
            <Td className="num text-right">{fmtInt(q.scheduled)}</Td>
            <Td className="num text-right">{fmtInt(q.retry)}</Td>
            <Td className={`num text-right ${q.failed ? "font-bold text-error-600" : ""}`}>{fmtInt(q.failed)}</Td>
            <Td className="num text-right text-muted">{fmtInt(q.processedToday)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

async function Schedule() {
  const r = await settle(listJobSchedule);
  if (!r.ok) return <Failed message={r.message} />;
  return r.data.length === 0 ? <Empty title="No cron jobs" /> : (
    <Table>
      <THead><Th>Job</Th><Th>Cron (sec min hour day month weekday)</Th></THead>
      <tbody>
        {r.data.map((s) => (
          <Tr key={s.name}><Td className="font-mono font-semibold">{s.name}</Td><Td className="font-mono text-[12.5px] text-muted">{s.cron}</Td></Tr>
        ))}
      </tbody>
    </Table>
  );
}

async function FailedCount() {
  const r = await settle(listFailedJobs);
  return r.ok ? <span className="num text-[12.5px] font-bold text-muted">{fmtInt(r.data.length)}</span> : null;
}

async function FailedJobs() {
  const [r, access] = await Promise.all([settle(listFailedJobs), getAccess()]);
  if (!r.ok) return <Failed message={r.message} />;
  const canManage = access.has("jobs.manage");
  return r.data.length === 0 ? <Empty title="No failed jobs" hint="Nothing in the dead-letter queues." /> : (
    <Table>
      <THead><Th>Failed</Th><Th>Queue</Th><Th>Type</Th><Th>Error</Th><Th>ID</Th><Th className="text-right">{canManage ? "Action" : ""}</Th></THead>
      <tbody>
        {r.data.map((f) => (
          <Tr key={`${f.queue}:${f.id}`}>
            <Td className="num text-muted">{fmtDateTime(f.failedAt)}</Td>
            <Td className="font-mono">{f.queue}</Td>
            <Td className="font-mono font-semibold">{f.type}</Td>
            <Td className="max-w-96 truncate text-error-600" title={f.error}>{f.error}</Td>
            <Td className="font-mono text-[11.5px] text-muted">{f.id}</Td>
            <Td className="text-right">{canManage && <RetryButton queue={f.queue} id={f.id} />}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

async function CronRuns() {
  const r = await settle(listCronRuns);
  if (!r.ok) return <Failed message={r.message} />;
  return r.data.length === 0 ? <Empty title="No cron runs yet" /> : (
    <Table>
      <THead><Th>Started</Th><Th>Job</Th><Th>Window</Th><Th>Status</Th><Th className="text-right">Took</Th><Th>Message</Th></THead>
      <tbody>
        {r.data.map((c) => (
          <Tr key={c.id}>
            <Td className="num text-muted">{fmtDateTime(c.startedAt)}</Td>
            <Td className="font-mono font-semibold">{c.job}</Td>
            <Td className="font-mono text-[12px] text-muted">{c.window}</Td>
            <Td><StatusPill status={c.status === "succeeded" ? "completed" : c.status} label={c.status} /></Td>
            <Td className="num text-right text-muted">{duration(c.startedAt, c.finishedAt)}</Td>
            <Td className="max-w-96 truncate" title={c.message}>{c.message || "—"}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

function TileSkeletons({ n }: { n: number }) {
  return Array.from({ length: n }, (_, i) => (
    <div key={i} className="card min-h-[148px] p-5" aria-busy="true">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-9 w-24" />
    </div>
  ));
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-6 border-b border-line px-5 last:border-0">
          <Skeleton className="h-3.5 w-28" /><Skeleton className="h-3.5 w-40" /><Skeleton className="ml-auto h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
