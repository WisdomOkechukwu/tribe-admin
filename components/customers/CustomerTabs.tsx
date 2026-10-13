"use client";

import Link from "next/link";
import { useParams, useSelectedLayoutSegment } from "next/navigation";
import { Icon } from "@/components/shell/icons";
import { cx } from "@/components/ui/cx";
import { useAccessStore } from "@/stores/access-store";

const TABS = [
  { seg: null, href: "", label: "Profile", perm: "customers.view" },
  { seg: "verifications", href: "/verifications", label: "Verifications", perm: "kyc.view" },
  { seg: "transactions", href: "/transactions", label: "Transactions", perm: "transactions.view" },
  { seg: "api-trail", href: "/api-trail", label: "API trail", perm: "api.view" },
];

/** Tabs are nested routes: each streams on its own, deep-links, and prefetches. */
export function CustomerTabs() {
  const { id } = useParams<{ id: string }>();
  const seg = useSelectedLayoutSegment();
  const perms = useAccessStore((s) => s.perms);
  return (
    <nav aria-label="Customer sections" className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
      <div className="inline-flex gap-1 rounded-full border-2 border-edge bg-surface p-1">
        {TABS.map((t) => {
          const active = seg === t.seg;
          if (perms && !perms.has(t.perm))
            return (
              <span key={t.label} aria-disabled="true" title="No access" className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-muted/60">
                <Icon name="lock" size={12} /> {t.label}
              </span>
            );
          return (
            <Link
              key={t.label}
              href={`/customers/${id}${t.href}`}
              prefetch
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cx(
                "press inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[13px] font-semibold",
                active ? "bg-ink-900 text-white dark:bg-orange-500 dark:text-ink-900" : "text-fg/70 hover:bg-orange-100 hover:text-ink-900 dark:hover:bg-orange-900/50 dark:hover:text-white",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
