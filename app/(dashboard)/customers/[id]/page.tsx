import { Gate } from "@/components/access/Gate";
import { AdjustmentsTable } from "@/components/customers/AdjustmentsTable";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { CurrencyChip, Money } from "@/components/ui/Money";
import { Empty, Facts, Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { getAccess } from "@/lib/auth/current";
import { getCustomer, listCustomerAdjustments } from "@/lib/data/repo";
import { isSuperAdmin } from "@/lib/domain/permissions";
import { NETWORKS, TIER_LIMITS, assetInfo } from "@/lib/domain/catalog";
import type { AssetCode } from "@/lib/domain/types";
import { fmtAgo, fmtDate, fmtDateTime, fullName } from "@/lib/format";

export default function ProfilePage({ params }: PageProps<"/customers/[id]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Gate perm="customers.view"><Profile params={params} /></Gate>
    </Suspense>
  );
}

const ACCOUNT_LABEL: Record<string, string> = { user_primary: "Wallet", user_card: "Card", user_referral: "Referral earnings" };

async function Profile({ params }: Pick<PageProps<"/customers/[id]">, "params">) {
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) notFound();
  const now = c.fetchedAt;
  const limits = TIER_LIMITS[c.kycTier] ?? TIER_LIMITS[0];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel title="Identity & contact">
        <Facts
          items={[
            ["Full name", fullName(c)],
            ["Tribe tag", `@${c.tag}`],
            ["Email", c.email],
            ["Phone", c.phone ? <span key="p" className="num">{c.phone}</span> : "—"],
            ["Date of birth", c.dob || "—"],
            ["Country", c.country || "—"],
            ["Address", c.address || "—"],
            ["Customer ID", <span key="i" className="font-mono text-[12.5px]">{c.id}</span>],
            ["Joined", fmtDateTime(c.createdAt)],
            ["Last active", c.lastActiveAt ? `${fmtDateTime(c.lastActiveAt)} (${fmtAgo(c.lastActiveAt, now)})` : "Never"],
          ]}
        />
      </Panel>

      <Panel title="Verification & limits" action={<Link href={`/customers/${c.id}/verifications`} className="link text-[12.5px] text-purple-700 dark:text-purple-200">All checks</Link>}>
        <Facts
          items={[
            ["KYC tier", `Tier ${c.kycTier}`],
            ["KYC status", <StatusPill key="k" status={c.kycStatus} />],
            ["Daily limit", limits.daily],
            ["Balance limit", limits.balance],
            ["Account status", <StatusPill key="s" status={c.status} />],
            ["Labels", c.labels.length ? c.labels.join(", ") : "—"],
          ]}
        />
      </Panel>

      <Panel title={`Balances · ${c.balances.length} accounts`} bodyClass="p-0" className="xl:col-span-2">
        {c.balances.length === 0 ? <Empty title="No wallets open yet" /> : (
          <Table>
            <THead><Th>Asset</Th><Th>Name</Th><Th>Account</Th><Th>Account no.</Th><Th className="text-right">Balance (ledger)</Th><Th>Deposit networks</Th></THead>
            <tbody>
              {c.balances.map((b) => (
                <Tr key={`${b.account}:${b.asset}:${b.accountNumber}`}>
                  <Td><CurrencyChip asset={b.asset} size="sm" /></Td>
                  <Td className="text-muted">{assetInfo(b.asset).name}</Td>
                  <Td>{ACCOUNT_LABEL[b.account] ?? b.account.replace(/_/g, " ")}</Td>
                  <Td className="num font-mono text-[12.5px] text-muted">{b.accountNumber}</Td>
                  <Td className="text-right font-bold"><Money asset={b.asset} amount={b.balance} /></Td>
                  <Td className="text-muted">{NETWORKS[b.asset as AssetCode]?.join(", ") ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Suspense fallback={<Skeleton className="h-40 rounded-card xl:col-span-2" />}>
        <Gate perm="inventory.view" compact><Adjustments customerId={c.id} /></Gate>
      </Suspense>

      <Panel title={`Devices · ${c.devices.length}`} bodyClass="p-0">
        {c.devices.length === 0 ? <Empty title="No devices" /> : (
          <Table>
            <THead><Th>Device</Th><Th>App</Th><Th>Last seen</Th><Th>State</Th></THead>
            <tbody>
              {c.devices.map((d) => (
                <Tr key={d.id}>
                  <Td><span className="font-medium">{d.name || d.model}</span> <span className="text-muted">· {d.platform} {d.model}</span></Td>
                  <Td className="num text-muted">{d.appVersion || "—"}</Td>
                  <Td className="text-muted">{d.lastSeenAt ? fmtAgo(d.lastSeenAt, now) : "—"}</Td>
                  <Td>{d.status === "active" ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">{d.status}</Badge>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title={`Virtual cards · ${c.cards.length}`} bodyClass="p-0">
        {c.cards.length === 0 ? <Empty title="No virtual cards" /> : (
          <Table>
            <THead><Th>Card</Th><Th>Design</Th><Th>Created</Th><Th>State</Th></THead>
            <tbody>
              {c.cards.map((k) => (
                <Tr key={k.id}>
                  <Td><span className="font-medium">{k.label}</span> <span className="text-muted">· {k.network === "visa" ? "Visa" : "Mastercard"} •• {k.last4}</span></Td>
                  <Td className="font-mono text-[12px] text-muted">{k.designFinish}</Td>
                  <Td className="text-muted">{fmtDate(k.createdAt)}</Td>
                  <Td>{k.frozen ? <Badge tone="error">Frozen</Badge> : <StatusPill status={k.status || "active"} />}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/** This customer's manual credits & debits; pending ones can be decided here by a super admin. */
async function Adjustments({ customerId }: { customerId: string }) {
  const [res, access] = await Promise.all([listCustomerAdjustments({ customer: customerId, page: 1 }), getAccess()]);
  return (
    <Panel title={`Manual credits & debits · ${res.total}`} bodyClass="p-0" className="xl:col-span-2" action={<Link href="/inventory#adjustments" className="link text-[12.5px] text-purple-700 dark:text-purple-200">All requests</Link>}>
      {res.rows.length === 0 ? <Empty title="No manual credits or debits" hint="Use “Credit / debit” above. A super admin approves before anything moves." /> : (
        <AdjustmentsTable rows={res.rows} adminId={access.admin.id} superAdmin={isSuperAdmin(access.perms)} canDecide={access.has("adjustments.approve")} canSeeLedger={access.has("ledger.view")} showCustomer={false} />
      )}
    </Panel>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56 rounded-card" />)}
    </div>
  );
}
