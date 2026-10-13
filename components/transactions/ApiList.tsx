import Link from "next/link";
import { HttpStatus } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import type { ApiRequest } from "@/lib/domain/types";
import { fmtDateTime, fmtInt } from "@/lib/format";

type Row = ApiRequest & { customerName?: string; customerTag?: string };

const METHOD: Record<string, string> = {
  GET: "text-blue-600 dark:text-blue-300", POST: "text-success-600 dark:text-success-300", PATCH: "text-orange-600 dark:text-orange-300",
  PUT: "text-orange-600", DELETE: "text-error-600",
};

/** Request log as <details> rows: expandable with zero client JS. */
export function ApiList({ rows, showCustomer = true }: { rows: Row[]; showCustomer?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className={cx("grid gap-3 border-b-2 border-line bg-surface px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted", showCustomer ? "grid-cols-[150px_64px_minmax(0,1fr)_64px_80px_180px_24px]" : "grid-cols-[150px_64px_minmax(0,1fr)_64px_80px_200px_24px]")}>
          <span>Time</span><span>Method</span><span>Path</span><span>Status</span><span className="text-right">Latency</span><span>{showCustomer ? "Customer" : "Device · IP"}</span><span />
        </div>
        {rows.map((r) => (
          <details key={r.id} className="group row-cv border-b border-line last:border-0 open:bg-sunken/60">
            <summary className={cx("grid cursor-pointer list-none items-center gap-3 px-5 py-2.5 text-[12.5px] hover:bg-purple-50/60 dark:hover:bg-purple-900/20 [&::-webkit-details-marker]:hidden", showCustomer ? "grid-cols-[150px_64px_minmax(0,1fr)_64px_80px_180px_24px]" : "grid-cols-[150px_64px_minmax(0,1fr)_64px_80px_200px_24px]")}>
              <span className="num text-muted">{fmtDateTime(r.at)}</span>
              <span className={cx("font-mono text-[12px] font-semibold", METHOD[r.method])}>{r.method}</span>
              <span className="truncate font-mono text-[12px]">{r.path}</span>
              <span><HttpStatus status={r.status} /></span>
              <span className={cx("num text-right", r.latencyMs > 1000 && "font-semibold text-error-600")}>{fmtInt(r.latencyMs)}ms</span>
              <span className="truncate text-muted">
                {showCustomer ? (r.customerName ? `${r.customerName} · @${r.customerTag}` : "—") : `${r.device} · ${r.ip}`}
              </span>
              <span className="grid size-6 place-items-center rounded-full border-2 border-edge bg-surface shadow-hard-sm group-open:bg-orange-500" aria-hidden>
                <svg width="10" height="10" viewBox="0 0 10 10" className="transition-transform group-open:rotate-180"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
              </span>
            </summary>
            <div className="grid grid-cols-1 gap-4 px-4 pt-1 pb-4 text-[12.5px] lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
              <dl className="space-y-1.5">
                <Meta k="Request ID" v={<span className="font-mono">{r.requestId}</span>} />
                <Meta k="Device" v={r.device} />
                <Meta k="IP" v={<span className="num">{r.ip}</span>} />
                {r.customerId && showCustomer && <Meta k="Customer" v={<Link className="link text-purple-700 dark:text-purple-200" href={`/customers/${r.customerId}/api-trail`}>{r.customerName ?? r.customerId}</Link>} />}
                {r.txId && <Meta k="Transaction" v={<Link className="link text-purple-700 dark:text-purple-200" href={`/transactions/${r.txId}`}>{r.txId}</Link>} />}
                {r.error && <Meta k="Error" v={<span className="text-error-600">{r.error}</span>} />}
              </dl>
              <Code label="Request body (redacted)" body={r.request} />
              <Code label="Response" body={r.response} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 break-all">{v}</dd>
    </div>
  );
}

function pretty(body?: string) {
  if (!body) return "—";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function Code({ label, body }: { label: string; body?: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11.5px] text-muted">{label}</div>
      <pre className="max-h-48 overflow-auto rounded-chip border border-line bg-surface p-3 font-mono text-[11.5px] leading-relaxed">{pretty(body)}</pre>
    </div>
  );
}
