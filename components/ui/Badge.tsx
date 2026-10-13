import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "purple" | "orange" | "success" | "error" | "warning" | "blue";

// Chunky pills: saturated fills with an ink outline, readable in both themes.
const TONE: Record<Tone, string> = {
  neutral: "bg-sunken text-muted ring-line",
  purple: "bg-purple-100 text-purple-900 ring-purple-300 dark:bg-purple-800 dark:text-purple-50 dark:ring-purple-600",
  orange: "bg-orange-100 text-orange-900 ring-orange-300 dark:bg-orange-800 dark:text-orange-50 dark:ring-orange-600",
  success: "bg-success-100 text-success-900 ring-success-300 dark:bg-success-900 dark:text-success-100 dark:ring-success-700",
  error: "bg-error-50 text-error-600 ring-error-500/50 dark:bg-error-600/25 dark:text-error-50 dark:ring-error-500/50",
  warning: "bg-warning-300 text-ink-900 ring-warning-500 dark:bg-warning-700/40 dark:text-warning-200 dark:ring-warning-700",
  blue: "bg-blue-50 text-blue-900 ring-blue-300 dark:bg-blue-900 dark:text-blue-50 dark:ring-blue-700",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset", TONE[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  completed: "success", approved: "success", active: "success", ready: "success", resolved: "success",
  pending: "warning", review: "warning", open: "warning",
  failed: "error", frozen: "error", closed: "neutral", cancelled: "neutral", reversed: "orange", none: "neutral",
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {label ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function KycBadge({ tier, status }: { tier: number; status?: string }) {
  const tone: Tone = status === "failed" ? "error" : status === "pending" ? "warning" : tier >= 3 ? "purple" : tier === 0 ? "neutral" : "blue";
  return (
    <Badge tone={tone}>
      Tier {tier}
      {status && status !== "approved" && status !== "none" ? ` · ${status}` : ""}
    </Badge>
  );
}

export function HttpStatus({ status }: { status: number }) {
  const tone: Tone = status >= 500 ? "error" : status >= 400 ? "warning" : status === 202 ? "blue" : "success";
  return <Badge tone={tone} className="num font-mono">{status}</Badge>;
}
