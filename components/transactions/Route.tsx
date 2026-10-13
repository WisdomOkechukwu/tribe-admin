import { CurrencyChip } from "@/components/ui/Money";
import { cx } from "@/components/ui/cx";
import { bookLabel, type RouteStep } from "@/lib/domain/catalog";
import type { Transaction } from "@/lib/domain/types";

// Shared (server + client): the full route a transaction took, showing which
// NGN books the money passed through, e.g. BTC → Crypto NGN → Fiat NGN → GBP.

export const routeOf = (tx: Pick<Transaction, "route">) => tx.route;

export function routeText(route: RouteStep[]) {
  return route.map((s) => (s.t === "asset" ? s.asset : s.t === "book" ? bookLabel(s.id) : s.label)).join(" → ");
}

export function BookChip({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border-2 border-edge bg-purple-500 font-bold whitespace-nowrap text-white", size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 pr-2.5 pl-1 text-[12px]")}>
      {size === "md" && <span className="grid size-5 place-items-center rounded-full bg-success-700 text-[10px] text-white" aria-hidden>₦</span>}
      {bookLabel(id)}
    </span>
  );
}

export function Route({ assets, size = "md" }: { assets: RouteStep[]; size?: "sm" | "md" }) {
  return (
    <span className={cx("inline-flex flex-wrap items-center", size === "sm" ? "gap-1" : "gap-1.5")} aria-label={`Route: ${routeText(assets)}`}>
      {assets.map((s, i) => (
        <span key={i} className={cx("inline-flex items-center", size === "sm" ? "gap-1" : "gap-1.5")}>
          {i > 0 && <span className="font-bold text-muted" aria-hidden>→</span>}
          {s.t === "asset" ? (
            size === "sm" ? <span className="rounded-full border-2 border-line px-1.5 text-[11px] font-bold">{s.asset}</span> : <CurrencyChip asset={s.asset} size="sm" />
          ) : s.t === "book" ? (
            <BookChip id={s.id} size={size} />
          ) : (
            <span className={cx("rounded-full border-2 border-dashed border-line font-semibold whitespace-nowrap text-muted", size === "sm" ? "px-1.5 text-[11px]" : "h-7 px-2.5 text-[12px] leading-6")}>{s.label}</span>
          )}
        </span>
      ))}
    </span>
  );
}
