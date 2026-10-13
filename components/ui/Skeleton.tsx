import { cx } from "./cx";

// Skeletons mirror each page's real layout, so nothing jumps when data lands.

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("shimmer rounded-chip", className)} aria-hidden />;

/** Small branded loader: three bouncing coins + a line of copy. */
export function BrandLoader({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-1 text-[12.5px] font-bold text-muted" role="status">
      <span className="inline-flex items-end gap-1" aria-hidden>
        {["bg-purple-500", "bg-orange-500", "bg-warning-300"].map((c, i) => (
          <span key={c} className={`size-2.5 animate-[coin_0.9s_ease-in-out_infinite] rounded-full border border-edge ${c}`} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </span>
      {text}
    </div>
  );
}

export function TableSkeleton({ rows = 10, text = "Fetching the latest…" }: { rows?: number; text?: string }) {
  const widths = ["w-40", "w-28", "w-52", "w-24", "w-36"];
  return (
    <div className="card overflow-hidden" aria-busy="true">
      <div className="flex h-12 items-center justify-between border-b-2 border-line bg-sunken px-5">
        <Skeleton className="h-3.5 w-32" />
        <BrandLoader text={text} />
      </div>
      <div className="flex h-11 items-center gap-6 border-b-2 border-line px-5">
        {[16, 24, 20, 14, 18].map((w) => (
          <div key={w} style={{ width: `${w}%` }}><Skeleton className="h-2.5" /></div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-6 border-b border-line px-5 last:border-0">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className={cx("h-3.5", widths[i % 5])} />
          <Skeleton className={cx("hidden h-3.5 sm:block", widths[(i + 2) % 5])} />
          <Skeleton className={cx("hidden h-3.5 md:block", widths[(i + 3) % 5])} />
          <Skeleton className="ml-auto h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card min-h-36 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-36" />
          <Skeleton className="mt-3 h-5 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ className, title = true, children }: { className?: string; title?: boolean; children?: React.ReactNode }) {
  return (
    <div className={cx("card overflow-hidden", className)} aria-busy="true">
      {title && <div className="flex h-14 items-center border-b-2 border-line px-5"><Skeleton className="h-4 w-40" /></div>}
      <div className="p-5">{children ?? <div className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>}</div>
    </div>
  );
}
