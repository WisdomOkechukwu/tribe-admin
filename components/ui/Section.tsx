"use client";

import { Suspense, use, type ReactNode } from "react";
import type { Section, SectionResult } from "@/lib/hooks/useSection";
import { cx } from "./cx";
import { BrandLoader } from "./Skeleton";

/**
 * The body of a useSection() section: `fallback` until the first read lands,
 * then dimmed (with a small loader) while this section alone reloads. A failed
 * read shows here only; the rest of the page carries on.
 */
export function SectionBody<D>({ section, fallback, children, className, bodyClass }: { section: Section<D>; fallback: ReactNode; children: (data: D) => ReactNode; className?: string; bodyClass?: string }) {
  return (
    <div aria-busy={section.pending || undefined} className={cx("relative", className)}>
      <div className={cx("transition-opacity duration-200", section.pending && "pointer-events-none opacity-50", bodyClass)}>
        <Suspense fallback={fallback}>
          <Resolved result={section.result}>{children}</Resolved>
        </Suspense>
      </div>
      {section.pending && (
        <span className="pointer-events-none absolute top-14 left-1/2 z-10 -translate-x-1/2 rounded-full border-2 border-edge bg-surface px-3 py-1 shadow-hard-sm">
          <BrandLoader />
        </span>
      )}
    </div>
  );
}

function Resolved<D>({ result, children }: { result: Promise<SectionResult<D>>; children: (data: D) => ReactNode }) {
  const r = use(result);
  return r.ok ? children(r.data) : <SectionError message={r.message} />;
}

export function SectionError({ message }: { message: string }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-1 px-6 py-10 text-center">
      <p className="display text-[20px] font-bold uppercase">Couldn&apos;t load this</p>
      <p className="text-[12.5px] text-muted">{message}</p>
    </div>
  );
}

/** Resolves a streamed value inline (e.g. a tab count); renders `fallback` until it lands. */
export function Streamed<T>({ value, fallback = null, children }: { value: Promise<T>; fallback?: ReactNode; children: (v: T) => ReactNode }) {
  return <Suspense fallback={fallback}><StreamedInner value={value}>{children}</StreamedInner></Suspense>;
}

function StreamedInner<T>({ value, children }: { value: Promise<T>; children: (v: T) => ReactNode }) {
  return children(use(value));
}
