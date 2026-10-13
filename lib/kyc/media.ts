import "server-only";
import { db } from "@/lib/data/db";
import type { KycMedia, Verification } from "@/lib/domain/types";
import { renderKycSvg } from "./art";

// id → (media, verification) index, built once per DB instance.
const g = globalThis as unknown as { __kycIdx?: { src: unknown; map: Map<string, { m: KycMedia; v: Verification }> } };

function index() {
  const d = db();
  if (g.__kycIdx?.src !== d) {
    const map = new Map<string, { m: KycMedia; v: Verification }>();
    for (const v of d.verifications) for (const m of v.media) map.set(m.id, { m, v });
    g.__kycIdx = { src: d, map };
  }
  return g.__kycIdx.map;
}

/** Returns the SVG for a KYC media id, or null. Caller must have authorised. */
export function kycMediaSvg(id: string): string | null {
  const hit = index().get(id);
  if (!hit) return null;
  const { m, v } = hit;
  const c = db().customerById.get(v.customerId);
  if (!c) return null;
  const idDoc = db().verifications.find((x) => x.customerId === c.id && x.check === "id_document");
  return renderKycSvg(m.kind, m.label, {
    seed: c.id,
    first: c.firstName,
    last: c.lastName,
    dob: c.dob,
    address: c.address,
    docType: v.check === "id_document" ? v.documentType : idDoc?.documentType,
    docMasked: v.check === "id_document" ? v.documentMasked : idDoc?.documentMasked,
    mismatch: v.status === "failed" && /match/i.test(v.reason ?? ""),
  });
}
