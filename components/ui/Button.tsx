import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "orange" | "ink";
type Size = "sm" | "md";

// Sticker buttons: pill, ink outline, hard shadow that collapses on press.
const VARIANT: Record<Variant, string> = {
  primary: "pop bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50",
  orange: "pop bg-orange-500 text-ink-900 hover:bg-orange-400",
  ink: "pop bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900",
  secondary: "pop bg-surface text-fg hover:bg-purple-50 dark:hover:bg-purple-900/40",
  ghost: "press text-muted hover:bg-sunken hover:text-fg",
  danger: "pop bg-error-600 text-white hover:bg-error-500",
};
const SIZE: Record<Size, string> = { sm: "h-8 px-3.5 text-[12.5px] gap-1.5", md: "h-10 px-5 text-[13.5px] gap-2" };

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", className?: string) =>
  cx("inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-semibold disabled:cursor-not-allowed", VARIANT[variant], SIZE[size], className);

export function Button({ variant, size, className, ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant, size, className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
