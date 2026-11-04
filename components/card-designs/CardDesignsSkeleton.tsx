import { BrandLoader, Skeleton } from "@/components/ui/Skeleton";

const PANELS = [{ rows: 7, title: "w-28" }, { rows: 6, title: "w-32" }, { rows: 6, title: "w-28" }];

/** The three design tables (themes, swatches, patterns) with card-shaped thumbs, as they load. */
export function CardDesignTablesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      {PANELS.map((p, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b-2 border-line px-5 py-3">
            <Skeleton className={`h-4 ${p.title}`} />
            {i === 0 ? <BrandLoader text="Fetching designs…" /> : <Skeleton className="hidden h-3 w-48 sm:block" />}
          </div>
          <div className="flex h-11 items-center gap-6 border-b-2 border-line px-5">
            {[10, 16, 12, 18, 6, 10].map((w, j) => (
              <div key={j} style={{ width: `${w}%` }}><Skeleton className="h-2.5" /></div>
            ))}
          </div>
          {Array.from({ length: p.rows }, (_, r) => (
            <div key={r} className="flex h-[69px] items-center gap-6 border-b border-line px-5 last:border-0">
              {/* the app's thumb: 72 wide at 1.586, rounded max(4, w·10%) */}
              <Skeleton className="h-[45px] w-[72px] shrink-0 rounded-[7px]" />
              <Skeleton className={r % 2 ? "h-3.5 w-24" : "h-3.5 w-32"} />
              <Skeleton className="hidden h-3 w-16 sm:block" />
              <Skeleton className="hidden h-3 w-28 md:block" />
              <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
              <div className="ml-auto flex gap-1.5">
                <Skeleton className="h-8 w-14 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The whole page (route loading): header, then the tables. */
export function CardDesignsPageSkeleton() {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4" aria-busy="true">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-11 w-72 sm:h-14" />
          <Skeleton className="mt-4 h-3.5 w-full max-w-2xl" />
          <Skeleton className="mt-2 h-3.5 w-2/3 max-w-xl" />
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <CardDesignTablesSkeleton />
    </>
  );
}
