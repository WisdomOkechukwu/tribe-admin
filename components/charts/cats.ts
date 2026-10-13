import { CATEGORIES } from "@/lib/domain/catalog";
import type { TxCategory } from "@/lib/domain/types";

/** Fixed colour per product (never by rank), validated categorical slots. */
export const CAT_COLOR: Record<TxCategory, string> = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, `var(--cat-${i + 1})`])) as Record<TxCategory, string>;
export const CAT_LIST = CATEGORIES;
