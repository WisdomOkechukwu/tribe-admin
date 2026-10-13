"use client";

import Link from "next/link";
import { useToasts } from "@/stores/toast-store";
import { cx } from "./cx";

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cx(
            "pointer-events-auto flex max-w-sm animate-[toast-in_180ms_ease-out] items-start gap-3 rounded-chip border-2 border-edge px-4 py-3 text-[13px] font-medium shadow-hard",
            t.tone === "success" ? "bg-success-100 text-success-900" : t.tone === "error" ? "bg-error-50 text-error-600" : t.tone === "support" ? "bg-warning-300 text-ink-900" : "bg-surface",
          )}
        >
          <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", t.tone === "success" ? "bg-success-500" : t.tone === "error" ? "bg-error-500" : t.tone === "support" ? "animate-ping bg-orange-500" : "bg-purple-500")} aria-hidden />
          <span className="min-w-0 flex-1">
            {t.title && <span className="block font-extrabold">{t.title}</span>}
            <span className="line-clamp-2 block">{t.message}</span>
            {t.href && (
              <Link href={t.href} onClick={() => dismiss(t.id)} className="pop mt-2 inline-flex h-7 items-center rounded-full bg-surface px-3 text-[12px] font-bold text-fg">
                {t.action ?? "Open"} →
              </Link>
            )}
          </span>
          <button type="button" onClick={() => dismiss(t.id)} className="press cursor-pointer text-muted hover:text-fg" aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
