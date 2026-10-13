"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

/** Native <dialog> modal: focus trap, Esc and inert background for free. */
export function Modal({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
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
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx("m-auto max-h-[90dvh] w-[calc(100%-32px)] overflow-hidden rounded-panel border-2 border-edge bg-surface p-0 text-fg shadow-hard", wide ? "max-w-5xl" : "max-w-lg")}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b-2 border-line px-6 py-5">
            <div>
              <h2 className="display text-[28px] font-extrabold uppercase">{title}</h2>
              {subtitle && <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="pop grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-surface text-fg">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto" data-lenis-prevent>{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-line bg-sunken px-6 py-3.5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
