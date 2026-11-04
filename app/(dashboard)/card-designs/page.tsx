import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/access/Gate";
import { CardDesignActions, NewCardDesign, type KindMap } from "@/components/card-designs/CardDesignEditor";
import { CardDesignTablesSkeleton } from "@/components/card-designs/CardDesignsSkeleton";
import { CardPreview } from "@/components/card-designs/CardPreview";
import { Badge } from "@/components/ui/Badge";
import { Empty, PageHeader, Panel } from "@/components/ui/Panel";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { getAccess } from "@/lib/auth/current";
import { listCardDesigns } from "@/lib/data/repo";
import { designKey, designLook } from "@/lib/domain/card-looks";
import type { CardDesign, CardDesignKind } from "@/lib/domain/types";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Card designs" };

const KINDS: { kind: CardDesignKind; title: string; blurb: string }[] = [
  { kind: "theme", title: "Themes", blurb: "The app's finishes; each can wear any enabled pattern" },
  { kind: "swatch", title: "Swatches", blurb: "Ready-made colours in “Make your own” (the colour slider stays)" },
  { kind: "pattern", title: "Patterns", blurb: "Overlays for every finish and colour" },
];

const byOrder = (a: CardDesign, b: CardDesign) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/** Per kind: the order a new design gets (last + 10) and the keys already added. */
function plan(designs: CardDesign[]) {
  const nextSort = {} as KindMap<number>;
  const taken = {} as KindMap<string[]>;
  for (const { kind } of KINDS) {
    const rows = designs.filter((d) => d.kind === kind);
    nextSort[kind] = rows.length ? Math.min(10_000, Math.max(...rows.map((d) => d.sortOrder)) + 10) : 0;
    taken[kind] = rows.map(designKey);
  }
  return { nextSort, taken };
}

export default function CardDesignsPage() {
  return (
    <>
      <PageHeader
        title="Card designs"
        subtitle="The looks customers can pick for their virtual cards, in this order and with these names. Turning a design off hides it from the app; cards already using it keep their look."
        actions={<Suspense fallback={null}><NewIfAllowed /></Suspense>}
      />
      <Suspense fallback={<CardDesignTablesSkeleton />}>
        <Gate perm="card_designs.manage"><Designs /></Gate>
      </Suspense>
    </>
  );
}

async function NewIfAllowed() {
  const a = await getAccess();
  if (!a.has("card_designs.manage")) return null;
  return <NewCardDesign {...plan(await listCardDesigns())} />;
}

async function Designs() {
  const designs = await listCardDesigns();
  return (
    <div className="space-y-6">
      {KINDS.map(({ kind, title, blurb }) => {
        const rows = designs.filter((d) => d.kind === kind).sort(byOrder);
        const on = rows.filter((d) => d.enabled).length;
        return (
          <Panel key={kind} title={`${title} · ${on}/${rows.length} on`} action={<span className="hidden text-[12px] text-muted sm:inline">{blurb}</span>} bodyClass="p-0">
            {rows.length === 0 ? <Empty title={`No ${title.toLowerCase()}`} hint="Customers can't pick any until you add one." /> : (
              <Table>
                <THead><Th>Preview</Th><Th>Name</Th><Th>Key</Th><Th>Id</Th><Th className="text-right">Order</Th><Th>State</Th><Th>Updated</Th><Th className="text-right">Actions</Th></THead>
                <tbody>
                  {rows.map((d) => {
                    const key = designKey(d);
                    const look = designLook(d.kind, key);
                    return (
                      <Tr key={d.id}>
                        <Td><CardPreview look={look} width={72} className={d.enabled ? undefined : "opacity-50 grayscale-[60%]"} /></Td>
                        <Td className="max-w-56"><span className={d.enabled ? "block truncate font-semibold" : "block truncate font-semibold text-muted"}>{d.name}</span></Td>
                        <Td className="font-mono text-[12px]">{d.kind === "swatch" ? `#${key}` : key || "—"}</Td>
                        <Td className="font-mono text-[12px] text-muted">{d.id}</Td>
                        <Td className="num text-right">{d.sortOrder}</Td>
                        <Td>
                          {!look ? <Badge tone="warning">App can&apos;t paint this</Badge> : d.enabled ? <Badge tone="success" dot>On</Badge> : <Badge dot>Off</Badge>}
                        </Td>
                        <Td className="text-muted">v{d.version} · {fmtDateTime(d.updatedAt)}</Td>
                        <Td className="text-right"><CardDesignActions design={d} /></Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
