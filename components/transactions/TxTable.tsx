import Link from "next/link";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Route, routeOf } from "./Route";
import { LegsButton } from "./TxDrawer";
import { typeLabel } from "@/lib/domain/catalog";
import type { TxRow } from "@/lib/domain/types";
import { fmtDateTime, fmtUsd } from "@/lib/format";

/** Short detail line: the API's subtitle (recipient, @tag, code or rate). */
export function txDetail(t: Pick<TxRow, "subtitle" | "meta">) {
  return t.subtitle || "";
}

export function TxTable({ rows, showCustomer = true }: { rows: TxRow[]; showCustomer?: boolean }) {
  return (
    <Table>
      <THead>
        <Th>Time</Th>
        <Th>Reference</Th>
        {showCustomer && <Th>Customer</Th>}
        <Th>Type</Th>
        <Th>Title · route</Th>
        <Th>Details</Th>
        <Th>Paid with / received</Th>
        <Th>Delivered</Th>
        <Th className="text-right">Fee</Th>
        <Th className="text-right">≈ USD</Th>
        <Th>Status</Th>
        <Th className="text-right">Ledger</Th>
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
                <Link href={`/customers/${t.customerId}`} className="link font-medium">{t.customerName ?? `${t.customerId.slice(0, 10)}…`}</Link>
                {t.customerTag && <span className="ml-1.5 text-[12px] text-muted">@{t.customerTag}</span>}
              </Td>
            )}
            <Td><Badge tone={t.direction === "in" ? "success" : "neutral"}>{typeLabel(t.type)}</Badge></Td>
            <Td className="min-w-56">
              <div className="max-w-64 truncate font-semibold">{t.title}</div>
              <div className="mt-1"><Route assets={routeOf(t)} size="sm" /></div>
            </Td>
            <Td className="num max-w-72 truncate text-[12.5px] text-muted">{txDetail(t) || "—"}</Td>
            <Td><Money asset={t.source.asset} amount={t.direction === "in" ? t.source.amount : `-${t.source.amount}`} tone icon /></Td>
            <Td>{t.destination ? <Money asset={t.destination.asset} amount={t.destination.amount} icon /> : <span className="text-muted">—</span>}</Td>
            <Td className="text-right text-muted">{t.fee && /[1-9]/.test(t.fee.amount) ? <Money asset={t.fee.asset} amount={t.fee.amount} /> : "—"}</Td>
            <Td className="num text-right">{fmtUsd(t.usdValue)}</Td>
            <Td><StatusPill status={t.status} /></Td>
            <Td className="text-right"><LegsButton id={t.id} /></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
