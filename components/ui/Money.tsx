import Image from "next/image";
import { ASSETS, ASSET_FACE } from "@/lib/domain/catalog";
import type { AssetCode } from "@/lib/domain/types";
import { fmtMoney } from "@/lib/format";
import { cx } from "./cx";

/** Amount in the currency's own look: optional coin/flag, symbol, precision. */
export function Money({ asset, amount, sign, tone, className, icon }: { asset: AssetCode; amount: number; sign?: boolean; tone?: boolean; className?: string; icon?: boolean }) {
  const color = tone ? (amount > 0 ? "text-success-600 dark:text-success-300" : amount < 0 ? "text-error-600 dark:text-error-50" : "") : "";
  return (
    <span className={cx("num inline-flex items-center gap-1.5 whitespace-nowrap", color, className)}>
      {icon && <AssetIcon asset={asset} size={16} />}
      {fmtMoney(asset, amount, { sign })}
    </span>
  );
}

/** Branded coin / flag. The coloured face with the symbol sits under the logo, so it still reads if the image is slow. */
export function AssetIcon({ asset, size = 18 }: { asset: AssetCode; size?: number }) {
  const a = ASSETS[asset];
  const face = ASSET_FACE[asset];
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold ring-2 ring-[var(--surface)]"
      style={{ width: size, height: size, background: face.bg, color: face.fg, fontSize: Math.max(8, size * 0.45) }}
    >
      <span aria-hidden>{a.symbol.slice(0, 2)}</span>
      {a.logo && <Image src={a.logo} alt="" width={size} height={size} className="absolute inset-0 size-full object-cover" unoptimized />}
    </span>
  );
}

export function AssetLabel({ asset }: { asset: AssetCode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <AssetIcon asset={asset} size={16} />
      <span className="font-semibold">{asset}</span>
    </span>
  );
}

/** Currency chip: coin + code + symbol, in the currency's colour. */
export function CurrencyChip({ asset, size = "md", amount }: { asset: AssetCode; size?: "sm" | "md"; amount?: number }) {
  const a = ASSETS[asset];
  const face = ASSET_FACE[asset];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border-2 border-edge bg-surface font-semibold shadow-hard-sm", size === "sm" ? "h-7 pr-2.5 pl-0.5 text-[12px]" : "h-9 pr-3.5 pl-1 text-[13px]")}>
      <AssetIcon asset={asset} size={size === "sm" ? 20 : 26} />
      <span>{asset}</span>
      {amount === undefined ? (
        <span className="rounded-full px-1.5 text-[11px]" style={{ background: face.bg, color: face.fg }}>{a.symbol}</span>
      ) : (
        <span className="num">{fmtMoney(asset, amount)}</span>
      )}
    </span>
  );
}
