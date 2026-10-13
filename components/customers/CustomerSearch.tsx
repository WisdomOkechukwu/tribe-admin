"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/shell/icons";
import { cx } from "@/components/ui/cx";

/**
 * The single customer search: free text (name, email, @tag, phone, ID) plus
 * tag chips (@handles or labels, all must match). Writes to the URL; results
 * are server-rendered, shareable and back/forward friendly.
 */
export function CustomerSearch({ labels }: { labels: string[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const urlQ = sp.get("q") ?? "";
  const urlTags = sp.get("tags") ?? "";
  const [q, setQ] = useState(urlQ);
  const [tags, setTags] = useState<string[]>(urlTags.split(",").filter(Boolean));
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sent = useRef({ q: urlQ, tags: urlTags });

  // Follow back/forward without clobbering typing.
  useEffect(() => {
    if (urlQ !== sent.current.q) { sent.current.q = urlQ; setQ(urlQ); }
    if (urlTags !== sent.current.tags) { sent.current.tags = urlTags; setTags(urlTags.split(",").filter(Boolean)); }
  }, [urlQ, urlTags]);

  const push = (nextQ: string, nextTags: string[]) => {
    const p = new URLSearchParams(sp.toString());
    if (nextQ.trim()) p.set("q", nextQ.trim());
    else p.delete("q");
    if (nextTags.length) p.set("tags", nextTags.join(","));
    else p.delete("tags");
    p.delete("page");
    sent.current = { q: nextQ.trim(), tags: nextTags.join(",") };
    start(() => router.replace(p.size ? `${pathname}?${p}` : pathname, { scroll: false }));
  };

  const setTagList = (next: string[]) => {
    setTags(next);
    push(q, next);
  };
  const addTag = (t: string) => {
    const v = t.trim().replace(/,/g, "");
    setDraft("");
    if (v && !tags.some((x) => x.toLowerCase() === v.toLowerCase()) && tags.length < 8) setTagList([...tags, v]);
  };

  return (
    <div className="card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <label className="flex h-12 items-center gap-2.5 rounded-full border-2 border-edge bg-surface px-4 focus-within:border-purple-500 focus-within:shadow-hard-sm">
          <Icon name="search" size={17} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => push(v, tags), 280);
            }}
            onKeyDown={(e) => e.key === "Enter" && (clearTimeout(timer.current), push(q, tags))}
            placeholder="Search name, email, @tag, phone or customer ID"
            aria-label="Search customers"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
          {pending && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" aria-label="Searching" />}
          {q && !pending && (
            <button type="button" onClick={() => { setQ(""); push("", tags); }} className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full bg-sunken text-muted hover:text-fg" aria-label="Clear search">
              <Icon name="close" size={11} />
            </button>
          )}
        </label>
        <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-[24px] border-2 border-edge bg-surface px-3 py-1.5 focus-within:border-purple-500 focus-within:shadow-hard-sm">
          <Icon name="ticket" size={15} className="shrink-0 text-muted" />
          {tags.map((t) => (
            <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-purple-500 pr-1 pl-2.5 text-[12px] font-bold text-white">
              {t}
              <button type="button" onClick={() => setTagList(tags.filter((x) => x !== t))} className="grid size-5 cursor-pointer place-items-center rounded-full hover:bg-white/20" aria-label={`Remove tag ${t}`}>
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "," || (e.key === "Enter" && draft.trim())) { e.preventDefault(); addTag(draft); }
              else if (e.key === "Backspace" && !draft && tags.length) setTagList(tags.slice(0, -1));
            }}
            onBlur={() => draft.trim() && addTag(draft)}
            placeholder={tags.length ? "Add another…" : "Tags: @handle or label, Enter to add"}
            aria-label="Add tag"
            className="h-7 min-w-36 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-muted">Quick tags</span>
        {labels.map((l) => {
          const on = tags.some((t) => t.toLowerCase() === l.toLowerCase());
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              onClick={() => setTagList(on ? tags.filter((t) => t.toLowerCase() !== l.toLowerCase()) : [...tags, l])}
              className={cx("pop h-7 cursor-pointer rounded-full px-3 text-[12px] font-semibold", on ? "bg-purple-500 text-white" : "bg-surface")}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
