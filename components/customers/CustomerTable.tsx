import Link from "next/link";
import { Icon } from "@/components/shell/icons";
import { Badge, KycBadge, StatusPill } from "@/components/ui/Badge";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { DATA_NOW } from "@/lib/data/repo";
import type { CustomerRow } from "@/lib/domain/types";
import { fmtAgo, fmtDate, fmtInt, fmtUsd, fullName, initials } from "@/lib/format";

export function Avatar({ c, size = 32 }: { c: { firstName: string; lastName: string }; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full border-2 border-edge bg-purple-100 text-[11px] font-extrabold text-purple-900 dark:bg-purple-800 dark:text-purple-50" style={{ width: size, height: size }} aria-hidden>
      {initials(c)}
    </span>
  );
}

const RISKY = ["high-risk", "watchlist", "chargeback-risk"];

/** Stacked cells (who / contact / dates) so the whole row fits without sideways scrolling on desktop. */
export function CustomerTable({ rows }: { rows: CustomerRow[] }) {
  return (
    <Table>
      <THead>
        <Th>Customer</Th>
        <Th>Contact</Th>
        <Th>KYC · status</Th>
        <Th>Labels</Th>
        <Th className="text-right">Balance</Th>
        <Th className="text-right">Tx</Th>
        <Th>Joined · active</Th>
        <Th className="text-right"><span className="sr-only">Open</span></Th>
      </THead>
      <tbody>
        {rows.map((c) => (
          <Tr key={c.id}>
            <Td>
              <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                <Avatar c={c} size={36} />
                <span className="min-w-0 leading-tight">
                  <span className="link block max-w-48 truncate">{fullName(c)}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">@{c.tag}</span>
                </span>
              </Link>
            </Td>
            <Td>
              <span className="block max-w-60 truncate">{c.email}</span>
              <span className="num mt-0.5 block text-[12px] text-muted">{c.phone}</span>
            </Td>
            <Td>
              <div className="flex flex-col items-start gap-1">
                <KycBadge tier={c.kycTier} status={c.kycStatus} />
                <StatusPill status={c.status} />
              </div>
            </Td>
            <Td>
              <div className="flex max-w-56 flex-wrap gap-1">
                {c.labels.length ? c.labels.map((l) => <Badge key={l} tone={RISKY.includes(l) ? "orange" : "purple"}>{l}</Badge>) : <span className="text-muted">—</span>}
              </div>
            </Td>
            <Td className="num text-right font-semibold">{fmtUsd(c.totalUsd)}</Td>
            <Td className="num text-right">{fmtInt(c.txCount)}</Td>
            <Td>
              <span className="block">{fmtDate(c.createdAt)}</span>
              <span className="mt-0.5 block text-[12px] text-muted">active {fmtAgo(c.lastActiveAt, DATA_NOW)}</span>
            </Td>
            <Td className="text-right">
              <Link href={`/customers/${c.id}`} className="pop inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3 text-[12px] font-bold" aria-label={`Open ${fullName(c)}`}>
                Open <Icon name="arrow" size={12} />
              </Link>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
