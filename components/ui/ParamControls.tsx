"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cx } from "./cx";
import { Picker, type Option } from "./Picker";

// URL-driven filters: the server renders results from searchParams, so the
// client only rewrites the URL (inside a transition, never blocking typing).
function useParamWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const write = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { sp, write, pending };
}

export function ParamSearch({ param = "q", placeholder, className, autoFocus }: { param?: string; placeholder: string; className?: string; autoFocus?: boolean }) {
  const { sp, write, pending } = useParamWriter();
  const [value, setValue] = useState(sp.get(param) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const urlValue = sp.get(param) ?? "";
  const lastSent = useRef(urlValue);

  // Follow back/forward navigation without clobbering what's being typed.
  useEffect(() => {
    if (urlValue !== lastSent.current) {
      lastSent.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  const send = (v: string) => {
    lastSent.current = v.trim();
    write({ [param]: v.trim() || null });
  };

  return (
    <label className={cx("relative flex h-8 items-center rounded-full border-2 border-edge bg-surface focus-within:border-purple-500", className)}>
      <svg width="14" height="14" viewBox="0 0 16 16" className="ml-2.5 shrink-0 text-muted" aria-hidden>
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => send(v), 280);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { clearTimeout(timer.current); send(value); }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[12.5px] outline-none placeholder:text-muted focus-visible:outline-none"
      />
      {pending && <span className="mr-2.5 size-3 shrink-0 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" aria-label="Loading" />}
    </label>
  );
}

export function ParamPicker({ param, options, label, placeholder = "All", className }: { param: string; options: Option[]; label: string; placeholder?: string; className?: string }) {
  const { sp, write } = useParamWriter();
  const opts: Option[] = [{ value: "", label: placeholder }, ...options];
  return <Picker value={sp.get(param) ?? ""} options={opts} label={label} onChange={(v) => write({ [param]: v || null })} className={className} />;
}

export function ParamDate({ param, label }: { param: string; label: string }) {
  const { sp, write } = useParamWriter();
  return (
    <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-2 border-edge bg-surface px-3 text-[12.5px] shadow-hard-sm focus-within:border-purple-500">
      <span className="font-semibold text-muted">{label}</span>
      <input
        type="date"
        defaultValue={sp.get(param) ?? ""}
        onChange={(e) => write({ [param]: e.target.value || null })}
        className="num bg-transparent outline-none focus-visible:outline-none [color-scheme:inherit]"
      />
    </label>
  );
}

export function ClearFilters({ keep = [] }: { keep?: string[] }) {
  const { sp, write } = useParamWriter();
  const keys = [...sp.keys()].filter((k) => k !== "page" && !keep.includes(k));
  if (!keys.length) return null;
  return (
    <button type="button" onClick={() => write(Object.fromEntries(keys.map((k) => [k, null])))} className="press h-8 cursor-pointer rounded-full px-3 text-[12.5px] font-semibold text-orange-600 underline decoration-2 underline-offset-4 hover:text-orange-700 dark:text-orange-300">
      Clear filters
    </button>
  );
}
