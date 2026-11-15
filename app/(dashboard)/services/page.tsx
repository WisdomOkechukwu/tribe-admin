import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { ServiceSwitchCard } from "@/components/services/ServiceSwitchCard";
import { Icon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/Badge";
import { Empty, PageHeader } from "@/components/ui/Panel";
import { CardsSkeleton } from "@/components/ui/Skeleton";
import { getAccess } from "@/lib/auth/current";
import { listServices } from "@/lib/data/repo";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Services"
        subtitle="Switch off anything customers should not use right now. Within about a second the app greys it out and the API refuses it, with your message. Money already on its way still settles or refunds, and customers can always cancel a cashpoint or delete a card."
      />
      <Suspense fallback={<CardsSkeleton n={6} />}>
        <Gate perm="services.view"><Services /></Gate>
      </Suspense>
    </>
  );
}

async function Services() {
  const [rows, access] = await Promise.all([listServices(), getAccess()]);
  const canManage = access.has("services.manage");
  if (!rows.length) return <div className="card"><Empty title="No services found" /></div>;
  const off = rows.filter((s) => !s.enabled).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={off ? "error" : "success"}>{off ? `${off} switched off` : "Everything is on"}</Badge>
        {!canManage && <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"><Icon name="lock" size={13} /> Read only: switching needs “Switch services on & off”.</p>}
      </div>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((s) => (
          <li key={s.code} className={`card flex flex-col gap-4 p-5 ${s.enabled ? "" : "border-error-500"}`}>
            <ServiceSwitchCard service={s} canManage={canManage} />
            <span className="text-[11.5px] text-muted"><span className="font-mono">{s.code}</span> · v{s.version} · updated {fmtDateTime(s.updatedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
