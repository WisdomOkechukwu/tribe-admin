import Link from "next/link";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Route } from "./Route";
import { LegsButton } from "./TxDrawer";
import { billerName, giftName, typeLabel } from "@/lib/domain/catalog";
import type { TxCategory, TxRow } from "@/lib/domain/types";
import { fmtDateTime, fmtNgnCompact } from "@/lib/format";

/** Category-aware detail line (cashpoint code, meter/token, gift brand, card…). */
export function txDetail(t: TxRow) {
  const m = t.meta;
  switch (t.category) {
    case "cashpoint":
      return m.cashpointCode ? `Code ${m.cashpointCode.replace(/(\d{4})(?=\d)/g, "$1 ")}${m.counterparty ? ` · ${m.counterparty}` : ""}` : "";
    case "utility":
      return [billerName(m.billerId), m.plan, m.target && `→ ${m.target}`, m.units && `${m.units} kWh`].filter(Boolean).join(" · ");
    case "giftcard":
      return `${giftName(m.giftBrand)} $${m.giftFaceUsd}`;
    case "virtual_card":
      return [`•• ${m.cardLast4}`, m.merchant].filter(Boolean).join(" · ");
    default:
      return [m.counterparty, m.network && `network ${m.network}`, m.channel].filter(Boolean).join(" · ");
  }
}

const DETAIL_HEAD: Record<TxCategory | "all", string> = {
  all: "Details", currency: "Counterparty / route", virtual_card: "Card · merchant", cashpoint: "Cashpoint code", utility: "Biller · target", giftcard: "Brand · face value",
};

export function TxTable({ rows, showCustomer = true, category }: { rows: TxRow[]; showCustomer?: boolean; category?: TxCategory }) {
  return (
    <Table>
      <THead>
        <Th>Time</Th>
        <Th>Reference</Th>
        {showCustomer && <Th>Customer</Th>}
        <Th>Type</Th>
        <Th>Title · route</Th>
        <Th>{DETAIL_HEAD[category ?? "all"]}</Th>
        <Th>Paid with / received</Th>
        <Th>Delivered</Th>
        <Th className="text-right">Fee</Th>
        <Th className="text-right">Revenue</Th>
        <Th>Status</Th>
        <Th className="text-right">Legs</Th>
      </THead>
      <tbody>
        {rows.map((t) => (
          <Tr key={t.id}>
            <Td className="num text-muted">{fmtDateTime(t.createdAt)}</Td>
            <Td>
              <Link href={`/transactions/${t.id}`} className="font-mono text-[12.5px] font-bold text-purple-700 underline decoration-purple-200 decoration-2 underline-offset-2 hover:decoration-purple-500 dark:text-purple-200">{t.reference}</Link>
            </Td>
            {showCustomer && (
              <Td>
                <Link href={`/customers/${t.customerId}`} className="link font-medium">{t.customerName}</Link>
                <span className="ml-1.5 text-[12px] text-muted">@{t.customerTag}</span>
              </Td>
            )}
            <Td><Badge tone={t.direction === "in" ? "success" : "neutral"}>{typeLabel(t.type)}</Badge></Td>
            <Td className="min-w-56">
              <div className="max-w-64 truncate font-semibold">{t.title}</div>
              <div className="mt-1"><Route assets={t.route} size="sm" /></div>
            </Td>
            <Td className="num max-w-72 truncate text-[12.5px] text-muted">{txDetail(t) || "—"}</Td>
            <Td><Money asset={t.source.asset} amount={t.direction === "in" ? t.source.amount : -t.source.amount} tone icon /></Td>
            <Td>{t.destination ? <Money asset={t.destination.asset} amount={t.destination.amount} icon /> : <span className="text-muted">—</span>}</Td>
            <Td className="text-right text-muted">{t.fee.amount ? <Money asset={t.fee.asset} amount={t.fee.amount} /> : "—"}</Td>
            <Td className="num text-right font-semibold">{t.markupRevenueNgn ? fmtNgnCompact(t.markupRevenueNgn) : <span className="font-normal text-muted">—</span>}</Td>
            <Td><StatusPill status={t.status} /></Td>
            <Td className="text-right"><LegsButton id={t.id} count={t.legCount} /></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
