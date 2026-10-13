import type { ReactNode } from "react";
import { cx } from "./cx";

/** One consistent filter row: same height, gap and alignment on every page. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
