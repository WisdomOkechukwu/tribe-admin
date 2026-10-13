"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "./cx";

export type Option = { value: string; label: string; hint?: string };

/**
 * Custom listbox (no native <select>). Keyboard: ↑/↓, Home/End, Enter, Esc,
 * and type-ahead. Renders a hidden input when `name` is set, for forms.
 */
export function Picker({
  value, options, onChange, placeholder = "Any", label, name, size = "sm", className, align = "left", disabled,
}: {
  value: string; options: Option[]; onChange?: (v: string) => void; placeholder?: string; label?: string; name?: string;
  size?: "sm" | "md"; className?: string; align?: "left" | "right"; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [current, setCurrent] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === current);

  // Follow the controlled value (adjust during render, not in an effect).
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setCurrent(value);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Scroll the list itself, never the page.
    const el = list.current?.children[active] as HTMLElement | undefined;
    if (el && list.current) {
      const l = list.current;
      if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop;
      else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight;
    }
  }, [active, open]);

  const choose = (v: string) => {
    setCurrent(v);
    setOpen(false);
    onChange?.(v);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setActive(Math.max(0, options.findIndex((o) => o.value === current)));
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) choose(options[active].value); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={root} className={cx("relative", className)}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label}
        disabled={disabled}
        onClick={() => { setActive(Math.max(0, options.findIndex((o) => o.value === current))); setOpen((o) => !o); }}
        onKeyDown={onKey}
        className={cx(
          "press flex w-full cursor-pointer items-center gap-2 border-2 bg-surface text-left disabled:opacity-60",
          size === "sm" ? "h-8 rounded-full px-3 text-[12.5px]" : "h-11 rounded-chip px-3 text-[13.5px]",
          open ? "border-purple-500" : "border-edge shadow-hard-sm hover:-translate-px",
        )}
      >
        {label && size === "sm" && <span className="font-semibold text-muted">{label}</span>}
        <span className={cx("min-w-0 flex-1 truncate", !selected && "text-muted")}>{selected?.label ?? placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")}>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          className={cx("absolute z-30 mt-1.5 max-h-72 min-w-full overflow-auto rounded-chip border-2 border-edge bg-surface p-1 shadow-hard", align === "right" ? "right-0" : "left-0")}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === current}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
              className={cx(
                "flex cursor-pointer items-center justify-between gap-4 whitespace-nowrap rounded-chip px-2.5 py-1.5 text-[12.5px]",
                i === active && "bg-purple-100 dark:bg-purple-800",
                o.value === current && "font-bold text-purple-700 dark:text-purple-50",
              )}
            >
              <span>{o.label}</span>
              {o.hint && <span className="text-[11.5px] font-normal text-muted">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
