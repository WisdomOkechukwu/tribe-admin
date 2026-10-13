"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cx } from "@/components/ui/cx";
import { useAccessStore } from "@/stores/access-store";
import { useSupport } from "@/stores/support-store";
import { useUi } from "@/stores/ui-store";
import { Icon } from "./icons";
import { NAV } from "./nav";

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

/** usePathname is request data on dynamic routes, so it streams in; the fallback is the same list unhighlighted. */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList pathname={null} />}>
      <ActiveNavLinks onNavigate={onNavigate} />
    </Suspense>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const unread = useSupport((s) => s.unread);
  const perms = useAccessStore((s) => s.perms);
  return (
    <ul className="space-y-1">
      {NAV.map((n) => {
        const active = pathname !== null && n.match(pathname);
        const locked = perms !== null && !perms.has(n.perm);
        if (locked)
          return (
            <li key={n.href}>
              <span aria-disabled="true" title={`${n.label}: no access`} className="flex h-10 cursor-not-allowed items-center gap-3 rounded-full px-3 text-[13.5px] font-semibold text-purple-100/35">
                <Icon name={n.icon} className="shrink-0" />
                <span className="flex-1 truncate line-through decoration-1 in-data-[sidebar=collapsed]:lg:hidden">{n.label}</span>
                <Icon name="lock" size={14} className="shrink-0 in-data-[sidebar=collapsed]:lg:hidden" />
              </span>
            </li>
          );
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={n.label}
              className={cx(
                "flex h-10 items-center gap-3 rounded-full px-3 text-[13.5px] font-semibold transition-colors",
                active ? "pop bg-orange-500 text-ink-900 [--edge:var(--color-ink-900)] [--hard:var(--color-ink-900)]" : "text-purple-100 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon name={n.icon} className="shrink-0" />
              <span className="flex-1 truncate in-data-[sidebar=collapsed]:lg:hidden">{n.label}</span>
              {n.href === "/support" && unread > 0 && (
                <span className="num grid min-w-6 place-items-center rounded-full border-2 border-ink-900 bg-warning-300 px-1.5 text-[11px] font-extrabold text-ink-900 in-data-[sidebar=collapsed]:lg:absolute in-data-[sidebar=collapsed]:lg:ml-6 in-data-[sidebar=collapsed]:lg:-mt-6" aria-label={`${unread} unread`}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1 text-white">
      <Image src="/brand/tribe-icon.png" alt="" width={36} height={36} className="rounded-chip ring-2 ring-white/20" priority />
      <span className="in-data-[sidebar=collapsed]:lg:hidden">
        <span className="display block text-[24px] leading-none font-extrabold uppercase">Tribe</span>
        <span className="mt-1 inline-block -rotate-2 rounded-full bg-warning-300 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-ink-900">admin</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  const toggle = useUi((s) => s.toggleCollapsed);
  const mobileNav = useUi((s) => s.mobileNav);
  const setMobileNav = useUi((s) => s.setMobileNav);

  return (
    <>
      {/* Desktop rail. Width is driven by html[data-sidebar] (set before paint), not React state. */}
      <aside className="sticky top-0 hidden h-dvh w-64 flex-col overflow-hidden border-r-2 border-edge bg-purple-900 px-3 py-5 lg:flex in-data-[sidebar=collapsed]:w-[76px]">
        <Brand />
        <nav aria-label="Main" className="mt-8 flex-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="stripes pointer-events-none -mx-3 mb-3 h-10 opacity-90 [--stripe-w:16px] in-data-[sidebar=collapsed]:hidden" aria-hidden />
        <button type="button" onClick={toggle} className="press flex h-9 cursor-pointer items-center gap-3 rounded-full px-3 text-[12.5px] font-semibold text-purple-200 hover:bg-white/10 hover:text-white" aria-label="Collapse sidebar">
          <Icon name="collapse" className="shrink-0 in-data-[sidebar=collapsed]:rotate-180" />
          <span className="in-data-[sidebar=collapsed]:lg:hidden">Collapse</span>
        </button>
      </aside>

      {/* Mobile drawer. */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 cursor-default bg-ink-900/50" aria-label="Close menu" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r-2 border-edge bg-purple-900 px-3 py-5 shadow-hard">
            <Brand />
            <nav aria-label="Main" className="mt-6 flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setMobileNav(false)} />
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

export function MobileMenuButton() {
  const setMobileNav = useUi((s) => s.setMobileNav);
  return (
    <button type="button" onClick={() => setMobileNav(true)} className="pop grid size-9 cursor-pointer place-items-center rounded-full bg-surface lg:hidden" aria-label="Open menu">
      <Icon name="menu" />
    </button>
  );
}
