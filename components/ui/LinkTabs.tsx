import Link from "next/link";
import type { ReactNode } from "react";
import { fmtInt } from "@/lib/format";
import { cx } from "./cx";

export type TabItem = { href: string; label: string; count?: number; active: boolean };

const tabClass = (active: boolean) =>
  cx(
    "press inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold",
    active ? "bg-ink-900 text-white dark:bg-orange-500 dark:text-ink-900" : "cursor-pointer text-fg/70 hover:bg-orange-100 hover:text-ink-900 dark:hover:bg-orange-900/50 dark:hover:text-white",
  );

/** The count pill inside a tab. */
export function TabCount({ n, active }: { n: number; active: boolean }) {
  return <span className={cx("num rounded-full px-1.5 text-[11px]", active ? "bg-orange-500 text-ink-900 dark:bg-ink-900 dark:text-white" : "bg-sunken")}>{fmtInt(n)}</span>;
}

/** Server-rendered segmented tab bar made of links (prefetchable, deep-linkable). */
export function LinkTabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex gap-1 rounded-full border-2 border-edge bg-surface p-1">
        {items.map((t) => (
          <Link key={t.href} href={t.href} scroll={false} aria-current={t.active ? "page" : undefined} className={tabClass(t.active)}>
            {t.label}
            {t.count !== undefined && <TabCount n={t.count} active={t.active} />}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export type ButtonTabItem = { value: string; label: string; active: boolean; count?: ReactNode };

/** The same tab bar for a client section: switching tabs reloads only that section (no navigation). */
export function ButtonTabs({ items, label, onSelect }: { items: ButtonTabItem[]; label: string; onSelect: (value: string) => void }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex gap-1 rounded-full border-2 border-edge bg-surface p-1">
        {items.map((t) => (
          <button key={t.value} type="button" aria-pressed={t.active} onClick={() => !t.active && onSelect(t.value)} className={tabClass(t.active)}>
            {t.label}
            {t.count}
          </button>
        ))}
      </div>
    </nav>
  );
}
