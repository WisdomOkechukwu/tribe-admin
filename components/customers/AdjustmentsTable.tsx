import Link from "next/link";
import { AdjustmentDecision } from "@/components/customers/AdjustmentDecision";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { AssetIcon, Money } from "@/components/ui/Money";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { CustomerAdjustment } from "@/lib/domain/types";
import { fmtDateTime } from "@/lib/format";

/**
 * Manual credits & debits. Used on Inventory (every customer) and on a
 * customer's profile (showCustomer=false). Pending rows get the decision
 * buttons; only super admins can use them.
 */
export function AdjustmentsTable({ rows, adminId, superAdmin, canDecide, canSeeLedger, showCustomer = true }: {
  rows: CustomerAdjustment[]; adminId: string; superAdmin: boolean; canDecide: boolean; canSeeLedger: boolean; showCustomer?: boolean;
}) {
  return (
    <Table>
      <THead>
        <Th>Requested</Th>{showCustomer && <Th>Customer</Th>}<Th>Type</Th><Th className="text-right">Amount</Th><Th>Reason</Th><Th>Requested by</Th><Th>Status</Th><Th>Decided by</Th><Th className="text-right">Decision · journal</Th>
      </THead>
      <tbody>
        {rows.map((a) => (
          <Tr key={a.id}>
            <Td className="num text-muted">{fmtDateTime(a.createdAt)}</Td>
            {showCustomer && (
              <Td className="max-w-48">
                <Link href={`/customers/${a.customerId}`} className="link block truncate font-semibold">{a.customerName}</Link>
                {a.customerTag && <span className="block truncate text-[12px] text-muted">@{a.customerTag}</span>}
              </Td>
            )}
            <Td>{a.kind === "credit" ? <Badge tone="success">+ Credit</Badge> : <Badge tone="error">− Debit</Badge>}</Td>
            <Td className="text-right font-bold">
              <span className="inline-flex items-center gap-1.5"><AssetIcon asset={a.asset} size={16} /><Money asset={a.asset} amount={a.kind === "debit" ? `-${a.amount}` : a.amount} tone /></span>
            </Td>
            <Td className="max-w-64 truncate text-[12.5px] text-muted" title={a.reason}>{a.reason}</Td>
            <Td>{a.requestedByName}{a.requestedBy === adminId && <span className="ml-1.5 rounded-full bg-orange-500 px-2 text-[10.5px] font-bold uppercase text-ink-900">you</span>}</Td>
            <Td><StatusPill status={a.status === "rejected" ? "failed" : a.status} label={a.status[0].toUpperCase() + a.status.slice(1)} /></Td>
            <Td className="max-w-56 text-[12.5px] text-muted">
              {a.approvedByName ? <span className="block truncate">{a.approvedByName}{a.decidedAt ? ` · ${fmtDateTime(a.decidedAt)}` : ""}</span> : "—"}
              {a.rejectionReason && <span className="block truncate text-error-600">{a.rejectionReason}</span>}
            </Td>
            <Td className="text-right">
              {a.status === "pending" ? (
                <AdjustmentDecision id={a.id} own={a.requestedBy === adminId} superAdmin={superAdmin && canDecide} />
              ) : a.journalEntryId ? (
                canSeeLedger ? <Link href={`/ledger?entry=${a.journalEntryId}`} className="link font-mono text-[12px]">{a.journalEntryId.slice(0, 10)}…</Link> : <span className="font-mono text-[12px] text-muted">{a.journalEntryId.slice(0, 10)}…</span>
              ) : "—"}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
