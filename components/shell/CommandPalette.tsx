"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { KycBadge, StatusPill } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { searchCustomers } from "@/lib/actions/admin";
import { usePalette } from "@/stores/palette-store";
import { Icon } from "./icons";
import { NAV } from "./nav";

type Hit = Awaited<ReturnType<typeof searchCustomers>>[number];

export function PaletteButton() {
  const setOpen = usePalette((s) => s.setOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
  return (
    <button type="button" onClick={() => setOpen(true)} className="press flex h-10 w-full max-w-md cursor-pointer items-center gap-2 rounded-full border-2 border-line bg-surface px-4 text-[12.5px] text-muted hover:border-edge">
      <Icon name="search" size={15} />
      <span className="flex-1 truncate text-left">Jump to customer, email or @tag…</span>
      <kbd className="hidden rounded-full bg-ink-900 px-2 py-0.5 font-sans text-[11px] font-bold text-white sm:inline dark:bg-purple-700">⌘K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const open = usePalette((s) => s.open);
  const setOpen = usePalette((s) => s.setOpen);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      onClick={(e) => e.target === ref.current && setOpen(false)}
      className="mx-auto mt-[12vh] w-[calc(100%-32px)] max-w-xl overflow-hidden rounded-panel border-2 border-edge bg-surface p-0 text-fg shadow-hard"
    >
      {/* Mounted only while open, so its search state resets on every open. */}
      {open && <PaletteBody />}
    </dialog>
  );
}

function PaletteBody() {
  const setOpen = usePalette((s) => s.setOpen);
  const recent = usePalette((s) => s.recent);
  const remember = usePalette((s) => s.remember);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; hits: Hit[] }>({ q: "", hits: [] });
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const term = q.trim();
  // Only show results that belong to the current query.
  const hits = term.length >= 2 && result.q === term ? result.hits : [];

  useEffect(() => {
    if (term.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      start(async () => {
        const r = await searchCustomers(term);
        if (mine === seq.current) {
          setResult({ q: term, hits: r });
          setActive(0);
        }
      });
    }, 150);
    return () => clearTimeout(t);
  }, [term]);

  const pages = term ? NAV.filter((n) => n.label.toLowerCase().includes(term.toLowerCase())) : [];
  type Item = { key: string; href: string; label: string; sub?: string; hit?: Hit };
  const items: Item[] = [
    ...hits.map((h) => ({ key: h.id, href: `/customers/${h.id}`, label: h.name, sub: `@${h.tag} · ${h.email}`, hit: h })),
    ...(term ? [] : recent.map((r) => ({ key: `r-${r.id}`, href: `/customers/${r.id}`, label: r.name, sub: `@${r.tag} · recent` }))),
    ...pages.map((p) => ({ key: `p-${p.href}`, href: p.href, label: p.label, sub: "Page" })),
  ];

  const go = (it: Item) => {
    if (it.hit) remember({ id: it.hit.id, name: it.hit.name, tag: it.hit.tag });
    setOpen(false);
    router.push(it.href);
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Icon name="search" size={16} className="text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active]); }
          }}
          placeholder="Name, email, @tag or page…"
          aria-label="Search customers"
          className="flex-1 bg-transparent py-4 text-[14px] outline-none placeholder:text-muted focus-visible:outline-none"
        />
        {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" />}
      </div>
      <ul className="max-h-[50vh] overflow-auto p-2" role="listbox">
        {items.length === 0 && <li className="px-3 py-8 text-center text-[12.5px] text-muted">{term.length < 2 ? "Type at least 2 characters." : pending ? "Searching…" : "No matches."}</li>}
        {items.map((it, i) => (
          <li key={it.key} role="option" aria-selected={i === active}>
            <button
              type="button"
              onPointerEnter={() => setActive(i)}
              onClick={() => go(it)}
              className={cx("flex w-full cursor-pointer items-center gap-3 rounded-chip px-3 py-2 text-left", i === active && "bg-purple-100 dark:bg-purple-800")}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.label}</span>
                {it.sub && <span className="block truncate text-[12px] text-muted">{it.sub}</span>}
              </span>
              {it.hit && <KycBadge tier={it.hit.kycTier} />}
              {it.hit && it.hit.status !== "active" && <StatusPill status={it.hit.status} />}
              <Icon name="arrow" size={14} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
