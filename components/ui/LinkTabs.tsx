import Link from "next/link";
import { fmtInt } from "@/lib/format";
import { cx } from "./cx";

export type TabItem = { href: string; label: string; count?: number; active: boolean };

/** Server-rendered segmented tab bar made of links (prefetchable, deep-linkable). */
export function LinkTabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex gap-1 rounded-full border-2 border-edge bg-surface p-1">
        {items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            scroll={false}
            aria-current={t.active ? "page" : undefined}
            className={cx(
              "press inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold",
              t.active ? "bg-ink-900 text-white dark:bg-orange-500 dark:text-ink-900" : "cursor-pointer text-fg/70 hover:bg-orange-100 hover:text-ink-900 dark:hover:bg-orange-900/50 dark:hover:text-white",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cx("num rounded-full px-1.5 text-[11px]", t.active ? "bg-orange-500 text-ink-900 dark:bg-ink-900 dark:text-white" : "bg-sunken")}>{fmtInt(t.count)}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
