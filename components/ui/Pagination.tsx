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

export function Pagination({ path, params, page, pages, total, pageSize }: { path: string; params: Params; page: number; pages: number; total: number; pageSize: number }) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const link = (p: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className="grid h-8 min-w-8 place-items-center rounded-chip px-2 text-ink-200 dark:text-ink-600">{label}</span>
    ) : (
      <Link href={hrefWith(path, params, { page: p === 1 ? undefined : String(p) })} scroll={false} className="pop grid h-8 min-w-8 place-items-center rounded-full bg-surface px-2 font-semibold text-fg" aria-label={`Page ${p}`}>
        {label}
      </Link>
    );
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
