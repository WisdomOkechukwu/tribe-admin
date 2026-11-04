import { CurrencyChip } from "@/components/ui/Money";
import { cx } from "@/components/ui/cx";
import type { SwapLeg, TxRow } from "@/lib/domain/types";

// Shared (server + client): the assets a transaction moved through. With swap
// legs from the API it shows every hop, e.g. USD → NGN → GBP on the NGN rail.

export function routeOf(tx: Pick<TxRow, "source" | "destination">, legs?: SwapLeg[]): string[] {
  if (legs?.length) {
    const sorted = [...legs].sort((a, b) => a.step - b.step);
    return [sorted[0].fromAsset, ...sorted.map((l) => l.toAsset)];
  }
  const out: string[] = [tx.source.asset];
  if (tx.destination && tx.destination.asset !== tx.source.asset) out.push(tx.destination.asset);
  return out;
}

export const routeText = (route: string[]) => route.join(" → ");

export function Route({ assets, size = "md" }: { assets: string[]; size?: "sm" | "md" }) {
  return (
    <span className={cx("inline-flex flex-wrap items-center", size === "sm" ? "gap-1" : "gap-1.5")} aria-label={`Route: ${routeText(assets)}`}>
      {assets.map((a, i) => (
        <span key={i} className={cx("inline-flex items-center", size === "sm" ? "gap-1" : "gap-1.5")}>
          {i > 0 && <span className="font-bold text-muted" aria-hidden>→</span>}
          {size === "sm" ? <span className="rounded-full border-2 border-line px-1.5 text-[11px] font-bold">{a}</span> : <CurrencyChip asset={a} size="sm" />}
        </span>
      ))}
    </span>
  );
}
