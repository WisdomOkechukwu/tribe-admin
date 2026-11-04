import Link from "next/link";
import { fmtInt } from "@/lib/format";
import { cx } from "./cx";

type Params = Record<string, string | undefined>;

export function hrefWith(path: string, params: Params, patch: Params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

type PageInfo = { page: number; pages: number; total: number; pageSize: number };
const STEP = "pop grid h-8 min-w-8 place-items-center rounded-full bg-surface px-2 font-semibold text-fg";

export function Pagination({ path, params, ...info }: PageInfo & { path: string; params: Params }) {
  return (
    <Pager {...info} step={(p, label) => (
      <Link href={hrefWith(path, params, { page: p === 1 ? undefined : String(p) })} scroll={false} className={STEP} aria-label={`Page ${p}`}>{label}</Link>
    )} />
  );
}

/** The same pager for a client section: paging reloads only that section (no navigation). */
export function PageButtons({ onPage, ...info }: PageInfo & { onPage: (page: number) => void }) {
  return (
    <Pager {...info} step={(p, label) => (
      <button type="button" onClick={() => onPage(p)} className={cx(STEP, "cursor-pointer")} aria-label={`Page ${p}`}>{label}</button>
    )} />
  );
}

function Pager({ page, pages, total, pageSize, step }: PageInfo & { step: (page: number, label: string) => React.ReactNode }) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const link = (p: number, label: string, disabled: boolean) =>
    disabled ? <span className="grid h-8 min-w-8 place-items-center rounded-chip px-2 text-ink-200 dark:text-ink-600">{label}</span> : step(p, label);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line bg-sunken px-5 py-3 text-[12.5px] text-muted">
      <span className="num">
        {fmtInt(from)}–{fmtInt(to)} of {fmtInt(total)}
      </span>
      <div className={cx("flex items-center gap-1", pages <= 1 && "invisible")}>
        {link(1, "«", page === 1)}
        {link(page - 1, "‹", page === 1)}
        <span className="num px-2">
          {page} / {pages}
        </span>
        {link(page + 1, "›", page >= pages)}
        {link(pages, "»", page >= pages)}
      </div>
    </div>
  );
}
