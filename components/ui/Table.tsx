import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

// Server-rendered table primitives. The wrapper scrolls horizontally inside
// itself so the page never overflows on mobile.
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-[1] bg-surface text-[11px] font-bold uppercase tracking-wider text-muted">
      <tr>{children}</tr>
    </thead>
  );
}

export const Th = ({ className, ...p }: ComponentProps<"th">) => <th className={cx("whitespace-nowrap border-b-2 border-line px-3 py-3 font-bold first:pl-5 last:pr-5", className)} {...p} />;

export const Tr = ({ className, ...p }: ComponentProps<"tr">) => <tr className={cx("row-cv border-b border-line last:border-0 hover:bg-purple-50/60 dark:hover:bg-purple-900/20", className)} {...p} />;

export const Td = ({ className, ...p }: ComponentProps<"td">) => <td className={cx("whitespace-nowrap px-3 py-3 align-middle first:pl-5 last:pr-5", className)} {...p} />;
