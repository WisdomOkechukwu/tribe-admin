import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export function Panel({ title, action, children, className, bodyClass, id, tone }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string; tone?: "plain" | "flat" }) {
  return (
    <section id={id} className={cx("min-w-0 overflow-hidden", tone === "flat" ? "rounded-card border-2 border-line bg-surface" : "card", className)}>
      {(title || action) && (
        <header className="flex min-h-14 items-center justify-between gap-3 border-b-2 border-line px-5 py-3">
          {title && <h2 className="display text-[19px] font-bold uppercase">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cx(bodyClass ?? "p-5")}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border-2 border-edge bg-orange-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-900">{eyebrow}</div>}
        <h1 className="display text-[40px] font-extrabold uppercase sm:text-[52px]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Definition list for profile-style facts. */
export function Facts({ items, cols = 2 }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cx("grid grid-cols-1 gap-x-6 gap-y-4", cols >= 2 && "sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</dt>
          <dd className="mt-1 break-words font-medium">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const STAT_TONE = {
  purple: "bg-purple-500 text-white",
  orange: "bg-orange-500 text-ink-900",
  yellow: "bg-warning-300 text-ink-900",
  ink: "bg-ink-900 text-white dark:bg-purple-900",
  plain: "bg-surface text-fg",
} as const;

/** Colour-block KPI tile. With `href` it becomes a pressable card (shadow + arrow). */
export function Stat({ label, value, sub, tone, color = "plain", children, href }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" | "flat"; color?: keyof typeof STAT_TONE; children?: ReactNode; href?: string }) {
  const onColor = color !== "plain";
  const body = (
    <>
      <div className={cx("pr-10 text-[11.5px] font-bold uppercase tracking-wider", onColor ? "opacity-80" : "text-muted")}>{label}</div>
      <div className="display num mt-4 mb-4 truncate text-[40px] font-extrabold leading-none">{value}</div>
      {sub && (
        <div className={cx("mt-auto inline-flex w-fit max-w-[calc(100%-2.5rem)] items-center truncate rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", onColor ? "bg-black/15" : tone === "up" ? "bg-success-100 text-success-900" : tone === "down" ? "bg-error-50 text-error-600" : "bg-sunken text-muted")}>
          {sub}
        </div>
      )}
      {children}
      {href && (
        <span className={cx("absolute top-4 right-4 grid size-8 place-items-center rounded-full border-2 border-current transition-transform", onColor ? "" : "text-fg")} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      )}
    </>
  );
  const cls = cx("relative flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-card p-5", STAT_TONE[color]);
  return href ? (
    <Link href={href} className={cx(cls, "pop")}>{body}</Link>
  ) : (
    <div className={cx(cls, "border-2 border-edge")}>{body}</div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <div className="stripes mb-3 h-3 w-20 rounded-full [--stripe-w:7px]" aria-hidden />
      <p className="display text-[20px] font-bold uppercase">{title}</p>
      {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

/** Card wrapper for tables/lists with a header strip. */
export function Sheet({ children, head, className }: { children: ReactNode; head?: ReactNode; className?: string }) {
  return (
    <div className={cx("card overflow-hidden", className)}>
      {head && <div className="flex min-h-12 flex-wrap items-center gap-x-6 gap-y-1 border-b-2 border-line bg-sunken px-5 py-3 text-[12.5px] text-muted">{head}</div>}
      {children}
    </div>
  );
}
