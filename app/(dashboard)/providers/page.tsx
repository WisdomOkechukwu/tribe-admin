import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { ProviderToggles } from "@/components/providers/ProviderToggles";
import { Icon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/Badge";
import { CurrencyChip } from "@/components/ui/Money";
import { Empty, PageHeader } from "@/components/ui/Panel";
import { CardsSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { listProviders } from "@/lib/data/repo";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Providers" };

export default function ProvidersPage() {
  return (
    <>
      <PageHeader
        title="Providers"
        subtitle="The partners that convert and pay out each asset. With the NGN rail on, conversions between two assets of the same provider go through naira (USD → NGN → GBP); with it off they convert directly. Different providers always use the rail."
      />
      <Suspense fallback={<CardsSkeleton n={4} />}>
        <Gate perm="providers.view"><Providers /></Gate>
      </Suspense>
    </>
  );
}

async function Providers() {
  const [rows, access] = await Promise.all([listProviders(), getAccess()]);
  const canManage = access.has("providers.manage");
  if (!rows.length) return <div className="card"><Empty title="No providers configured" /></div>;
  return (
    <div className="space-y-4">
      {!canManage && <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"><Icon name="lock" size={13} /> Read only: switching needs “Change providers & NGN rail”.</p>}
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((p) => (
          <li key={p.id} className={`card flex flex-col overflow-hidden ${p.enabled ? "" : "opacity-75"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-line p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="display text-[22px] font-extrabold uppercase">{p.name}</h2>
                  {p.isSimulator && (
                    <span className="inline-flex -rotate-2 items-center gap-1 rounded-full border-2 border-ink-900 bg-warning-300 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-900 shadow-hard-sm" title="This provider is a local simulator: no real money moves.">
                      <Icon name="alert" size={12} /> Simulated
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[12px] text-muted">{p.slug} · {p.category.replace(/_/g, " ")}</div>
              </div>
              <div className="flex gap-1.5">
                {p.usesNgnRail && <Badge tone="success">NGN rail</Badge>}
                {p.supportsDirectConversion && <Badge tone="blue">Direct conversion</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 px-5 pt-4">
              {p.assets.length ? p.assets.map((a) => <CurrencyChip key={a} asset={a} size="sm" />) : <span className="text-[12.5px] text-muted">No assets assigned</span>}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 p-5">
              <ProviderToggles id={p.id} name={p.name} usesNgnRail={p.usesNgnRail} enabled={p.enabled} version={p.version} canManage={canManage} />
              <span className="text-[11.5px] text-muted">v{p.version} · updated {fmtDateTime(p.updatedAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
