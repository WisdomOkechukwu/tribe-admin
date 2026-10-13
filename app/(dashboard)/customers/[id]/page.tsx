import { Gate } from "@/components/access/Gate";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { CurrencyChip, Money } from "@/components/ui/Money";
import { Empty, Facts, Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { DATA_NOW, getCustomer } from "@/lib/data/repo";
import { ASSETS, NETWORKS, TIER_LIMITS, billerName, toUsd } from "@/lib/domain/catalog";
import type { AssetCode } from "@/lib/domain/types";
import { fmtAgo, fmtDate, fmtDateTime, fmtInt, fmtUsd, fullName } from "@/lib/format";

export default function ProfilePage({ params }: PageProps<"/customers/[id]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Gate perm="customers.view"><Profile params={params} /></Gate>
    </Suspense>
  );
}

const yes = (b: boolean) => (b ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>);

/** Mock deposit details per asset (real ones come from the providers). */
function depositDetail(asset: AssetCode, tag: string) {
  if (ASSETS[asset].kind === "crypto") return `Networks: ${(NETWORKS[asset] ?? []).join(", ")}`;
  if (asset === "NGN") return "Tribe MFB (Partner) · NUBAN on file";
  if (asset === "USD") return "ACH account + routing (Global FX partner)";
  if (asset === "GBP") return "Account no. + sort code";
  if (asset === "EUR") return "IBAN / BIC";
  if (asset === "KES") return "M-Pesa paybill";
  if (asset === "GHS") return "MoMo number";
  return `Account for @${tag}`;
}

async function Profile({ params }: Pick<PageProps<"/customers/[id]">, "params">) {
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) notFound();
  const limits = TIER_LIMITS[c.kycTier];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel title="Identity & contact">
        <Facts
          items={[
            ["Full name", fullName(c)],
            ["Tribe tag", `@${c.tag}`],
            ["Email", c.email],
            ["Phone", <span key="p" className="num">{c.phone}</span>],
            ["Date of birth", c.dob],
            ["Country", c.country],
            ["Address", c.address],
            ["Customer ID", <span key="i" className="font-mono text-[12.5px]">{c.id}</span>],
            ["Joined", fmtDateTime(c.createdAt)],
            ["Last active", `${fmtDateTime(c.lastActiveAt)} (${fmtAgo(c.lastActiveAt, DATA_NOW)})`],
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
            ["Global accounts (USD/GBP/EUR)", <StatusPill key="g" status={c.globalAccounts} label={c.globalAccounts === "none" ? "Not requested" : undefined} />],
            ["Account status", <StatusPill key="s" status={c.status} />],
          ]}
        />
      </Panel>

      <Panel title={`Wallets · ${c.opened.length} open`} bodyClass="p-0" className="xl:col-span-2">
        <Table>
          <THead><Th>Asset</Th><Th>Name</Th><Th className="text-right">Balance</Th><Th className="text-right">USD value</Th><Th>Deposit details</Th></THead>
          <tbody>
            {c.opened.map((a) => (
              <Tr key={a}>
                <Td><CurrencyChip asset={a} size="sm" /></Td>
                <Td className="text-muted">{ASSETS[a].name}</Td>
                <Td className="text-right font-bold"><Money asset={a} amount={c.balances[a] ?? 0} /></Td>
                <Td className="num text-right text-muted">{fmtUsd(toUsd(a, c.balances[a] ?? 0))}</Td>
                <Td className="text-muted">{depositDetail(a, c.tag)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel title="Security">
        <Facts
          cols={2}
          items={[
            ["Biometrics", yes(c.security.biometrics)],
            ["Two-factor", yes(c.security.twoFactor)],
            ["Transaction PIN", c.security.pinSet ? <Badge tone="success">Set</Badge> : <Badge tone="warning">Not set</Badge>],
            ["Failed app-lock attempts", <span key="f" className={c.security.lockFails ? "font-semibold text-error-600" : ""}>{c.security.lockFails}</span>],
          ]}
        />
      </Panel>

      <Panel title={`Devices · ${c.devices.length}`} bodyClass="p-0">
        <Table>
          <THead><Th>Device</Th><Th>IP</Th><Th>Last active</Th><Th>Trust</Th></THead>
          <tbody>
            {c.devices.map((d) => (
              <Tr key={d.id}>
                <Td><span className="font-medium">{d.name}</span> <span className="text-muted">· {d.os}</span> {d.current && <Badge tone="purple">current</Badge>}</Td>
                <Td className="num text-muted">{d.ip}</Td>
                <Td className="text-muted">{fmtAgo(d.lastActive, DATA_NOW)}</Td>
                <Td>{d.trusted ? <Badge tone="success">Trusted</Badge> : <Badge tone="warning">Untrusted</Badge>}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel title={`Virtual cards · ${c.cards.length}`} bodyClass="p-0">
        {c.cards.length === 0 ? <Empty title="No virtual cards" /> : (
          <Table>
            <THead><Th>Card</Th><Th className="text-right">Balance</Th><Th className="text-right">Spent / limit</Th><Th>Created</Th><Th>State</Th></THead>
            <tbody>
              {c.cards.map((k) => (
                <Tr key={k.id}>
                  <Td><span className="font-medium">{k.label}</span> <span className="text-muted">· {k.network === "visa" ? "Visa" : "Mastercard"} •• {k.last4}</span></Td>
                  <Td className="text-right"><Money asset="USD" amount={k.balance} /></Td>
                  <Td className="num text-right text-muted">{fmtUsd(k.spentThisMonth)} / {fmtUsd(k.monthlyLimit)}</Td>
                  <Td className="text-muted">{fmtDate(k.createdAt)}</Td>
                  <Td>{k.frozen ? <Badge tone="error">Frozen</Badge> : <Badge tone="success">Active</Badge>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title={`Recurring bills · ${c.recurring.length}`} bodyClass="p-0">
        {c.recurring.length === 0 ? <Empty title="No recurring bills" /> : (
          <Table>
            <THead><Th>Biller</Th><Th>Target</Th><Th className="text-right">Amount</Th><Th>Pays with</Th><Th>Frequency</Th><Th>Next run</Th><Th>State</Th></THead>
            <tbody>
              {c.recurring.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{billerName(r.billerId)}</Td>
                  <Td className="num text-muted">{r.target}</Td>
                  <Td className="text-right"><Money asset="NGN" amount={r.amountNgn} /></Td>
                  <Td>{r.payWith}</Td>
                  <Td className="capitalize">{r.frequency === "biweekly" ? "Every 2 weeks" : r.frequency}</Td>
                  <Td className="text-muted">{fmtDate(r.nextRun)}</Td>
                  <Td>{r.active ? <Badge tone="success">Active</Badge> : <Badge>Paused</Badge>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title={`Token Vault · ${c.vault.length} electricity tokens`} bodyClass="p-0" className="xl:col-span-2">
        {c.vault.length === 0 ? <Empty title="No electricity tokens yet" /> : (
          <Table>
            <THead><Th>Bought</Th><Th>DisCo</Th><Th>Meter</Th><Th className="text-right">Amount</Th><Th className="text-right">Units</Th><Th>Token</Th><Th>Loaded</Th></THead>
            <tbody>
              {c.vault.slice().reverse().slice(0, 30).map((t) => (
                <Tr key={t.id}>
                  <Td className="text-muted">{fmtDateTime(t.bought)}</Td>
                  <Td>{t.provider}</Td>
                  <Td className="num">{t.meter}</Td>
                  <Td className="text-right"><Money asset="NGN" amount={t.amount} /></Td>
                  <Td className="num text-right">{t.kwh} kWh</Td>
                  <Td className="font-mono text-[12.5px]">{t.token.replace(/(\d{4})(?=\d)/g, "$1 ")}</Td>
                  <Td>{t.loadedOn ? <Badge tone="success">Loaded {fmtDate(t.loadedOn)}</Badge> : <Badge tone="warning">Not loaded</Badge>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title={`Beneficiaries · ${c.beneficiaries.length}`} bodyClass="p-0">
        {c.beneficiaries.length === 0 ? <Empty title="No saved beneficiaries" /> : (
          <Table>
            <THead><Th>Name</Th><Th>Kind</Th><Th>Handle / account</Th><Th>Asset</Th></THead>
            <tbody>
              {c.beneficiaries.map((b) => (
                <Tr key={b.id}>
                  <Td className="font-medium">{b.name}</Td>
                  <Td className="capitalize">{b.kind}</Td>
                  <Td className="font-mono text-[12.5px] text-muted">{b.handle}{b.network ? ` · ${b.network}` : ""}</Td>
                  <Td>{b.asset}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5">
        <Panel title="Referrals">
          <Facts
            items={[
              ["Referral code", <span key="r" className="font-mono">{c.referral.code}</span>],
              ["Referred by", c.referral.referredBy ?? "—"],
              ["Friends invited", fmtInt(c.referral.invited)],
              ["Earning (₦25 per tx)", `${fmtInt(c.referral.earning)} friends · ₦${fmtInt(c.referral.earnedNgn)}`],
            ]}
          />
        </Panel>
        <Panel title={`Support tickets · ${c.tickets.length}`} bodyClass="p-0">
          {c.tickets.length === 0 ? <Empty title="No support tickets" /> : (
            <Table>
              <THead><Th>Ticket</Th><Th>Reason</Th><Th>Transaction</Th><Th>Status</Th></THead>
              <tbody>
                {c.tickets.map((t) => (
                  <Tr key={t.id}>
                    <Td><Link href={`/support?t=${t.id}`} className="link font-mono text-[12.5px]">{t.id}</Link></Td>
                    <Td className="max-w-64 truncate">{t.reason}</Td>
                    <Td>{t.txId ? <Link className="link text-purple-700 dark:text-purple-200" href={`/transactions/${t.txId}`}>View</Link> : "—"}</Td>
                    <Td><StatusPill status={t.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56 rounded-card" />)}
    </div>
  );
}
