"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Modal } from "@/components/ui/Modal";
import type { KycMedia } from "@/lib/domain/types";

const FACE = new Set(["selfie", "liveness_frame", "bvn_photo", "nin_photo"]);
const src = (m: KycMedia) => `/kyc-media/${m.id}`;
const isDoc = (m: KycMedia) => m.kind === "id_front" || m.kind === "id_back";

/**
 * KYC evidence: clickable thumbnails (pressable stickers) that open a lightbox
 * with zoom, keyboard nav and side-by-side compare against the record photo.
 * Images come from the auth-gated /kyc-media route and are never optimised
 * or cached by shared caches.
 */
export function MediaGallery({ media, reference, size = "md", title }: { media: KycMedia[]; reference?: KycMedia; size?: "sm" | "md"; title?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [compare, setCompare] = useState(false);
  if (!media.length) return <span className="text-[12px] text-muted">No images</span>;

  const cur = open !== null ? media[open] : null;
  const canCompare = !!reference && !!cur && FACE.has(cur.kind) && cur.id !== reference.id;
  const go = (d: number) => { setZoom(false); setOpen((o) => (o === null ? o : (o + d + media.length) % media.length)); };

  // Uniform thumbnails so rows line up: sm = 44px squares, md = 76px tall tiles.
  const dims = (m: KycMedia) => {
    if (size === "sm") return { w: 44, h: 44 };
    if (isDoc(m)) return { w: 120, h: 76 };
    if (m.kind === "proof_of_address") return { w: 58, h: 76 };
    return { w: 62, h: 76 };
  };
  return (
    <>
      <ul className={cx("flex gap-2", size === "sm" ? "flex-nowrap" : "flex-wrap")}>
        {media.map((m, i) => {
          const { w, h } = dims(m);
          return (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                onClick={() => { setOpen(i); setZoom(false); setCompare(false); }}
                className={cx("pop group relative block cursor-zoom-in overflow-hidden bg-sunken", size === "sm" ? "rounded-[10px]" : "rounded-chip")}
                aria-label={`View ${m.label}`}
                title={m.label}
              >
                <Image src={src(m)} alt={m.label} width={w} height={h} unoptimized loading="lazy" className={cx("block object-cover", FACE.has(m.kind) ? "object-[50%_25%]" : "object-top")} style={{ width: w, height: h }} />
                <span className={cx("absolute grid place-items-center rounded-full border-2 border-edge bg-surface group-hover:bg-orange-500", size === "sm" ? "right-0.5 bottom-0.5 size-4" : "right-1 bottom-1 size-5")} aria-hidden>
                  <Icon name="zoom" size={size === "sm" ? 8 : 10} />
                </span>
              </button>
              {size === "md" && <span className="mt-1 block truncate text-[10.5px] text-muted" style={{ maxWidth: w }}>{m.label.replace(/^(Liveness frame|ID document) · /, "")}</span>}
            </li>
          );
        })}
      </ul>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        wide
        title={cur?.label ?? "Image"}
        subtitle={`${title ? `${title} · ` : ""}${open !== null ? open + 1 : 0} of ${media.length} · use ← → to browse, click the image to zoom`}
        footer={
          <>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => go(-1)} disabled={media.length < 2} aria-label="Previous image"><Icon name="chevronL" size={14} /> Prev</Button>
              <Button size="sm" onClick={() => go(1)} disabled={media.length < 2} aria-label="Next image">Next <Icon name="chevronR" size={14} /></Button>
            </div>
            <div className="flex items-center gap-2">
              {canCompare && (
                <Button size="sm" variant={compare ? "ink" : "secondary"} onClick={() => { setCompare((c) => !c); setZoom(false); }} aria-pressed={compare}>
                  <Icon name="compare" size={14} /> {compare ? "Single view" : "Compare with record photo"}
                </Button>
              )}
              {!compare && <Button size="sm" variant={zoom ? "ink" : "secondary"} onClick={() => setZoom((z) => !z)} aria-pressed={zoom}><Icon name="zoom" size={14} /> {zoom ? "Fit" : "Zoom 2×"}</Button>}
              {cur && <a href={src(cur)} target="_blank" rel="noopener noreferrer" className="link text-[12.5px]">Open original</a>}
            </div>
          </>
        }
      >
        {cur && (
          <div
            className="bg-sunken p-4 outline-none"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") go(1);
              if (e.key === "ArrowLeft") go(-1);
            }}
          >
            {compare && reference ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[{ m: reference, tag: "Record photo (government)" }, { m: cur, tag: "Submitted by customer" }].map(({ m, tag }) => (
                  <figure key={m.id} className="card overflow-hidden">
                    <Image src={src(m)} alt={m.label} width={480} height={600} unoptimized className="block h-auto w-full" />
                    <figcaption className={cx("border-t-2 border-line px-3 py-2 text-[12px] font-bold", m.id === reference.id ? "bg-blue-50 text-blue-900 dark:bg-blue-900 dark:text-blue-50" : "bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-50")}>{tag}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className={cx("mx-auto max-h-[64dvh] overflow-auto rounded-chip", zoom ? "cursor-zoom-out" : "cursor-zoom-in")} onClick={() => setZoom((z) => !z)}>
                <Image
                  src={src(cur)}
                  alt={cur.label}
                  width={isDoc(cur) ? 860 : cur.kind === "proof_of_address" ? 620 : 480}
                  height={isDoc(cur) ? 540 : cur.kind === "proof_of_address" ? 820 : 600}
                  unoptimized
                  className={cx("mx-auto block h-auto max-w-none transition-[width]", zoom ? "w-[200%] sm:w-[160%]" : "w-full max-w-[640px]")}
                />
              </div>
            )}
            {media.length > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {media.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => { setOpen(i); setZoom(false); }} aria-label={m.label} aria-current={i === open} className={cx("overflow-hidden rounded-[8px] border-2", i === open ? "border-orange-500" : "border-line opacity-70 hover:opacity-100")}>
                    <Image src={src(m)} alt="" width={48} height={40} unoptimized className="block h-10 w-12 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
