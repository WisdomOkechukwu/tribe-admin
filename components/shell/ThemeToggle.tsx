"use client";

import { useEffect } from "react";
import { cx } from "@/components/ui/cx";
import { resolveTheme, useUi, type Theme } from "@/stores/ui-store";
import { Icon } from "./icons";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);

  // Track OS changes while on "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => (document.documentElement.dataset.theme = resolveTheme("system"));
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      className={cx("pop grid size-9 cursor-pointer place-items-center rounded-full bg-surface", className)}
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
      title={`Theme: ${theme}`}
      suppressHydrationWarning
    >
      <Icon name={theme === "dark" ? "moon" : theme === "light" ? "sun" : "system"} />
    </button>
  );
}
