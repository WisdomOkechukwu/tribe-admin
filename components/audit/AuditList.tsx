import Link from "next/link";
import { Badge, type Tone } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { isPermission, permMeta } from "@/lib/domain/permissions";
import type { AuditEvent } from "@/lib/domain/types";
import { fmtDateTime } from "@/lib/format";

const TONE: Record<string, Tone> = { inventory: "purple", markup: "orange", kyc: "blue", customer: "warning", support: "success", team: "error", login: "neutral", logout: "neutral" };
const GRID = "grid-cols-[150px_150px_130px_minmax(0,1fr)_28px] lg:grid-cols-[160px_170px_150px_190px_minmax(0,1fr)_28px]";

function targetHref(action: string, target: string) {
  if (target.startsWith("cus_")) return action.startsWith("kyc") ? `/customers/${target}/verifications` : `/customers/${target}`;
  if (action.startsWith("inventory")) return `/inventory?pool=${encodeURIComponent(target)}#ledger`;
  if (action.startsWith("team")) return "/team";
  if (action.startsWith("support")) return `/support?t=${encodeURIComponent(target)}`;
  return null;
}

/** Audit rows that expand (no JS) to the full summary and a readable before → after diff. */
export function AuditList({ rows }: { rows: AuditEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className={cx("grid items-center gap-4 border-b-2 border-line px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted", GRID)}>
          <span>Time</span><span>Admin</span><span>Action</span><span className="hidden lg:block">Target</span><span>Summary</span><span />
        </div>
        {rows.map((a) => {
          const href = targetHref(a.action, a.target);
          return (
            <details key={a.id} className="group row-cv border-b border-line last:border-0 open:bg-sunken/70">
              <summary className={cx("grid cursor-pointer list-none items-center gap-4 px-5 py-3 text-[13px] hover:bg-purple-50/60 dark:hover:bg-purple-900/20 [&::-webkit-details-marker]:hidden", GRID)}>
                <span className="num text-muted">{fmtDateTime(a.at)}</span>
                <span className="truncate font-semibold">{a.adminName}</span>
                <span><Badge tone={TONE[a.action.split(".")[0]] ?? "neutral"}>{a.action}</Badge></span>
                <span className="hidden truncate font-mono text-[12px] text-muted lg:block">{a.target}</span>
                <span className="truncate">{a.summary}</span>
                <span className="grid size-7 place-items-center rounded-full border-2 border-edge bg-surface shadow-hard-sm group-open:bg-orange-500 group-open:text-ink-900" aria-hidden>
                  <svg width="10" height="10" viewBox="0 0 10 10" className="transition-transform group-open:rotate-180"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
                </span>
              </summary>
              <div className="grid grid-cols-1 gap-5 px-5 pt-1 pb-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <dl className="space-y-2.5 text-[12.5px]">
                  <Meta k="What happened"><span className="font-medium whitespace-pre-wrap break-words">{a.summary}</span></Meta>
                  <Meta k="When">{fmtDateTime(a.at)} (Lagos)</Meta>
                  <Meta k="Who">{a.adminName} <span className="font-mono text-[11px] text-muted">{a.adminId}</span></Meta>
                  <Meta k="Target">
                    {href ? <Link href={href} className="link font-mono text-[12px]">{a.target}</Link> : <span className="font-mono text-[12px]">{a.target}</span>}
                  </Meta>
                  <Meta k="Event ID"><span className="font-mono text-[11px] text-muted">{a.id}</span></Meta>
                </dl>
                <div className="min-w-0">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Change</div>
                  {a.before === undefined && a.after === undefined ? <p className="text-[12.5px] text-muted">No before/after recorded for this event.</p> : <Diff before={a.before} after={a.after} />}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function Meta({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-muted">{k}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

const asJson = (s?: string) => {
  try {
    const v = s ? JSON.parse(s) : undefined;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const asList = (s?: string) => (s && s.includes(", ") ? s.split(", ") : s && s !== "—" && !/\s/.test(s) && s.includes(".") ? [s] : null);
const asNum = (s?: string) => (s !== undefined && s !== "" && !Number.isNaN(Number(s)) ? Number(s) : null);
const labelFor = (x: string) => (isPermission(x) ? permMeta(x).item.label : x);

/** Picks the clearest view for the shape of the values. */
function Diff({ before, after }: { before?: string; after?: string }) {
  const jb = asJson(before), ja = asJson(after);
  if (jb || ja) {
    const keys = [...new Set([...Object.keys(jb ?? {}), ...Object.keys(ja ?? {})])];
    return (
      <div className="overflow-hidden rounded-chip border-2 border-line">
        <table className="w-full text-[12.5px]">
          <thead className="bg-surface text-[10.5px] font-bold uppercase tracking-wider text-muted"><tr><th className="px-3 py-2 text-left">Field</th><th className="px-3 py-2 text-left">Before</th><th className="px-3 py-2 text-left">After</th></tr></thead>
          <tbody>
            {keys.map((k) => {
              const b = JSON.stringify(jb?.[k]), a = JSON.stringify(ja?.[k]);
              const changed = b !== a;
              return (
                <tr key={k} className={cx("border-t border-line", changed && "bg-orange-50 dark:bg-orange-900/25")}>
                  <td className="px-3 py-1.5 font-semibold">{k}</td>
                  <td className={cx("num px-3 py-1.5", changed && "text-error-600 line-through dark:text-error-50")}>{b ?? "—"}</td>
                  <td className={cx("num px-3 py-1.5", changed && "font-bold text-success-700 dark:text-success-300")}>{a ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  const lb = asList(before), la = asList(after);
  if (lb || la) {
    const b = new Set(lb ?? []), a = new Set(la ?? []);
    const added = [...a].filter((x) => !b.has(x)), removed = [...b].filter((x) => !a.has(x)), kept = [...a].filter((x) => b.has(x));
    return (
      <div className="space-y-3">
        {added.length > 0 && <Chips title={`Added · ${added.length}`} items={added} tone="add" />}
        {removed.length > 0 && <Chips title={`Removed · ${removed.length}`} items={removed} tone="remove" />}
        {kept.length > 0 && <Chips title={`Unchanged · ${kept.length}`} items={kept} tone="keep" />}
      </div>
    );
  }
  const nb = asNum(before), na = asNum(after);
  if (nb !== null && na !== null) {
    const d = na - nb;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-chip border-2 border-line bg-surface p-3 text-[13px]">
        <span className="num text-muted">{nb.toLocaleString("en-NG", { maximumFractionDigits: 8 })}</span>
        <span aria-hidden>→</span>
        <span className="num font-extrabold">{na.toLocaleString("en-NG", { maximumFractionDigits: 8 })}</span>
        <span className={cx("num rounded-full px-2 py-0.5 text-[12px] font-bold", d >= 0 ? "bg-success-100 text-success-900" : "bg-error-50 text-error-600")}>{d >= 0 ? "+" : "−"}{Math.abs(d).toLocaleString("en-NG", { maximumFractionDigits: 8 })}</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="rounded-chip border-2 border-line bg-surface p-3"><div className="mb-1 text-[10.5px] font-bold uppercase text-muted">Before</div><p className="text-[12.5px] break-words whitespace-pre-wrap">{before ?? "—"}</p></div>
      <div className="rounded-chip border-2 border-edge bg-surface p-3"><div className="mb-1 text-[10.5px] font-bold uppercase text-muted">After</div><p className="text-[12.5px] font-semibold break-words whitespace-pre-wrap">{after ?? "—"}</p></div>
    </div>
  );
}

function Chips({ title, items, tone }: { title: string; items: string[]; tone: "add" | "remove" | "keep" }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold text-muted">{title}</div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <li key={x} title={x} className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", tone === "add" ? "bg-success-100 text-success-900" : tone === "remove" ? "bg-error-50 text-error-600 line-through" : "border-2 border-line text-muted")}>
            {tone === "add" ? "+ " : tone === "remove" ? "− " : ""}{labelFor(x)}
          </li>
        ))}
      </ul>
    </div>
  );
}
