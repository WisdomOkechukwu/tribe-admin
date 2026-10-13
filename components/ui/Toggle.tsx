"use client";

import { cx } from "./cx";

/** Controlled switch. Brand purple when on, never system green. */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("press relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-edge transition-colors disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-purple-500" : "bg-ink-50 dark:bg-ink-700")}
    >
      <span className={cx("absolute top-0.5 left-0.5 size-5 rounded-full border-2 border-edge bg-white transition-transform", on && "translate-x-5")} />
    </button>
  );
}
