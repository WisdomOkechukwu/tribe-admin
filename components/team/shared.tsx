import { Icon } from "@/components/shell/icons";
import { cx } from "@/components/ui/cx";
import type { AvatarColor, Risk } from "@/lib/domain/permissions";

// Shared (server + client) team visuals. Keep data objects out of "use client"
// modules: the server can't read values from a client module.

export const AVATAR_BG: Record<AvatarColor, string> = {
  purple: "bg-purple-500 text-white", orange: "bg-orange-500 text-ink-900", blue: "bg-blue-500 text-white",
  success: "bg-success-500 text-white", warning: "bg-warning-300 text-ink-900", ink: "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900",
};

export function TeamAvatar({ name, color, size = 40 }: { name: string; color: AvatarColor; size?: number }) {
  const ini = name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-full border-2 border-edge font-extrabold", AVATAR_BG[color])} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {ini}
    </span>
  );
}

export const RISK: Record<Risk, { label: string; cls: string; icon: "eye" | "key" | "lock" }> = {
  view: { label: "View", cls: "bg-blue-50 text-blue-900 ring-blue-300 dark:bg-blue-900 dark:text-blue-50", icon: "eye" },
  action: { label: "Action", cls: "bg-orange-100 text-orange-900 ring-orange-300 dark:bg-orange-900/60 dark:text-orange-50", icon: "key" },
  sensitive: { label: "Sensitive", cls: "bg-error-50 text-error-600 ring-error-500/40 dark:bg-error-600/25 dark:text-error-50", icon: "lock" },
};

export function RiskBadge({ risk }: { risk: Risk }) {
  const r = RISK[risk];
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ring-inset", r.cls)}>
      <Icon name={r.icon} size={11} /> {r.label}
    </span>
  );
}

