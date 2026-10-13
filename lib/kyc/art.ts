// Synthetic KYC imagery for the mock dataset. Every image is an illustration
// stamped "SAMPLE", never a real face or document. In production this module
// goes away: the route streams the real file from QoreID / object storage.
import type { KycMediaKind } from "@/lib/domain/types";

export type ArtCtx = {
  seed: string; // customer id: same person → same face across photos
  first: string;
  last: string;
  dob: string;
  docType?: string;
  docMasked?: string;
  address: string;
  mismatch?: boolean; // failed "selfie doesn't match" checks draw a different face
  variant?: number;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SKIN = ["#8d5524", "#a0662f", "#6b3e1f", "#c68642", "#5a3214", "#7a4a2a"];
const HAIR = ["#1b1210", "#2a1a12", "#120c0a", "#3b2316"];
const SHIRT = ["#690dac", "#ff6220", "#0095ff", "#2ba349", "#201f1f", "#b54617"];
const BG = ["#f0e7f7", "#ffefe9", "#e6f4ff", "#eaf6ed", "#fffbeb"];

type Pose = "front" | "left" | "blink";

/** Simple illustrated portrait centred in a w×h box. */
function face(seed: string, w: number, h: number, pose: Pose = "front", mismatch = false) {
  const n = hash(mismatch ? `${seed}-other` : seed);
  const skin = SKIN[n % SKIN.length];
  const hair = HAIR[(n >> 3) % HAIR.length];
  const shirt = SHIRT[(n >> 5) % SHIRT.length];
  const style = (n >> 7) % 4; // 0 short, 1 afro, 2 braids, 3 headwrap
  const cx = w / 2 + (pose === "left" ? -w * 0.04 : 0);
  const cy = h * 0.42;
  const r = Math.min(w, h) * 0.2;
  const dx = pose === "left" ? -r * 0.28 : 0;
  const eyeY = cy - r * 0.05;
  const eye = (x: number) =>
    pose === "blink"
      ? `<path d="M${x - r * 0.13},${eyeY} q${r * 0.13},${r * 0.07} ${r * 0.26},0" stroke="#1b1210" stroke-width="${r * 0.05}" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="${x}" cy="${eyeY}" rx="${r * 0.1}" ry="${r * 0.07}" fill="#fff"/><circle cx="${x + dx * 0.15}" cy="${eyeY}" r="${r * 0.05}" fill="#1b1210"/>`;
  const hairShape =
    style === 1 ? `<circle cx="${cx}" cy="${cy - r * 0.45}" r="${r * 1.15}" fill="${hair}"/>`
    : style === 2 ? `<path d="M${cx - r * 1.05},${cy + r * 0.9} V${cy - r * 0.4} Q${cx},${cy - r * 1.6} ${cx + r * 1.05},${cy - r * 0.4} V${cy + r * 0.9}" fill="${hair}"/>${Array.from({ length: 7 }, (_, i) => `<line x1="${cx - r * 0.9 + i * r * 0.3}" y1="${cy - r * 0.6}" x2="${cx - r * 0.9 + i * r * 0.3}" y2="${cy + r * 0.95}" stroke="#000" stroke-opacity=".25" stroke-width="${r * 0.04}"/>`).join("")}`
    : style === 3 ? `<path d="M${cx - r * 1.08},${cy - r * 0.2} Q${cx - r * 1.1},${cy - r * 1.7} ${cx},${cy - r * 1.55} Q${cx + r * 1.2},${cy - r * 1.7} ${cx + r * 1.08},${cy - r * 0.2} Z" fill="${shirt}"/><path d="M${cx - r * 0.9},${cy - r * 0.75} Q${cx},${cy - r * 1.1} ${cx + r * 0.9},${cy - r * 0.75}" stroke="#fff" stroke-opacity=".35" stroke-width="${r * 0.08}" fill="none"/>`
    : `<path d="M${cx - r * 0.98},${cy - r * 0.15} Q${cx - r},${cy - r * 1.25} ${cx},${cy - r * 1.18} Q${cx + r},${cy - r * 1.25} ${cx + r * 0.98},${cy - r * 0.15} Q${cx},${cy - r * 0.75} ${cx - r * 0.98},${cy - r * 0.15}Z" fill="${hair}"/>`;
  return `
    <ellipse cx="${w / 2}" cy="${h * 1.02}" rx="${w * 0.36}" ry="${h * 0.3}" fill="${shirt}"/>
    <rect x="${cx - r * 0.32}" y="${cy + r * 0.7}" width="${r * 0.64}" height="${r * 0.6}" fill="${skin}"/>
    ${style === 1 || style === 2 ? hairShape : ""}
    <ellipse cx="${cx - r * 0.98}" cy="${cy + r * 0.05}" rx="${r * 0.14}" ry="${r * 0.22}" fill="${skin}"/>
    <ellipse cx="${cx + r * 0.98}" cy="${cy + r * 0.05}" rx="${r * 0.14}" ry="${r * 0.22}" fill="${skin}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.15}" fill="${skin}"/>
    ${style === 0 || style === 3 ? hairShape : ""}
    <path d="M${cx - r * 0.5 + dx},${eyeY - r * 0.22} q${r * 0.15},-${r * 0.08} ${r * 0.3},0 M${cx + r * 0.2 + dx},${eyeY - r * 0.22} q${r * 0.15},-${r * 0.08} ${r * 0.3},0" stroke="#1b1210" stroke-width="${r * 0.05}" fill="none" stroke-linecap="round"/>
    ${eye(cx - r * 0.35 + dx)}${eye(cx + r * 0.35 + dx)}
    <path d="M${cx + dx},${cy + r * 0.05} q-${r * 0.1},${r * 0.25} ${r * 0.02},${r * 0.3}" stroke="#000" stroke-opacity=".35" stroke-width="${r * 0.04}" fill="none"/>
    <path d="M${cx - r * 0.3 + dx},${cy + r * 0.55} q${r * 0.3},${r * 0.2} ${r * 0.6},0" stroke="#5a1f1f" stroke-width="${r * 0.06}" fill="none" stroke-linecap="round"/>`;
}

function watermark(w: number, h: number) {
  return `<g opacity=".16" font-family="Arial, sans-serif" font-weight="700" fill="#201f1f" transform="rotate(-24 ${w / 2} ${h / 2})">
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="${Math.round(w / 9)}">SAMPLE</text>
    <text x="${w / 2}" y="${h / 2 + w / 14}" text-anchor="middle" font-size="${Math.round(w / 30)}">QoreID demo · not a real document</text>
  </g>`;
}

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}${watermark(w, h)}</svg>`;

function portrait(ctx: ArtCtx, pose: Pose, caption: string) {
  const w = 480, h = 600;
  const bg = BG[hash(ctx.seed + caption) % BG.length];
  return svg(w, h, `
    <rect width="${w}" height="${h}" fill="${bg}"/>
    ${face(ctx.seed, w, h, pose, ctx.mismatch && caption !== "record")}
    <rect x="0" y="${h - 44}" width="${w}" height="44" fill="#201f1f" opacity=".82"/>
    <text x="16" y="${h - 16}" font-family="Arial, sans-serif" font-size="16" fill="#fff">${esc(caption === "record" ? "Government record photo" : caption)}</text>
    <circle cx="${w - 24}" cy="${h - 22}" r="6" fill="${caption === "record" ? "#54b8ff" : "#ff1919"}"/>`);
}

const DOC_TITLE: Record<string, string> = {
  PASSPORT_NGA: "PASSPORT", DRIVERS_LICENSE_NGA: "DRIVER'S LICENCE", VOTERS_CARD_NGA: "VOTER'S CARD", NIN_SLIP_NGA: "NATIONAL ID (NIN SLIP)",
};

function idFront(ctx: ArtCtx) {
  const w = 860, h = 540;
  const title = DOC_TITLE[ctx.docType ?? ""] ?? "IDENTITY DOCUMENT";
  const field = (y: number, k: string, v: string) =>
    `<text x="300" y="${y}" font-family="Arial, sans-serif" font-size="15" fill="#6f6e6e">${esc(k)}</text><text x="300" y="${y + 26}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#201f1f">${esc(v)}</text>`;
  const waves = Array.from({ length: 9 }, (_, i) => `<path d="M0,${200 + i * 28} C${w * 0.25},${170 + i * 28} ${w * 0.5},${240 + i * 28} ${w},${190 + i * 28}" stroke="#1f7434" stroke-opacity=".08" fill="none" stroke-width="2"/>`).join("");
  return svg(w, h, `
    <rect width="${w}" height="${h}" rx="28" fill="#f6f2ea"/>
    ${waves}
    <rect width="${w}" height="92" rx="28" fill="#1f7434"/><rect y="60" width="${w}" height="32" fill="#1f7434"/>
    <text x="34" y="44" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#fff">FEDERAL REPUBLIC OF NIGERIA</text>
    <text x="34" y="74" font-family="Arial, sans-serif" font-size="16" fill="#eaf6ed">${esc(title)}</text>
    <circle cx="${w - 60}" cy="46" r="28" fill="#fff" opacity=".9"/><circle cx="${w - 60}" cy="46" r="16" fill="#1f7434"/>
    <svg x="34" y="122" width="230" height="290" viewBox="0 0 480 600"><rect width="480" height="600" fill="#e6f4ff"/>${face(ctx.seed, 480, 600, "front", false)}</svg>
    <rect x="34" y="122" width="230" height="290" fill="none" stroke="#201f1f" stroke-opacity=".25" stroke-width="2"/>
    ${field(140, "Surname", ctx.last.toUpperCase())}
    ${field(206, "Given names", ctx.first.toUpperCase())}
    ${field(272, "Date of birth", ctx.dob)}
    ${field(338, "Document no.", ctx.docMasked ?? "••••••")}
    <text x="34" y="460" font-family="Arial, sans-serif" font-size="15" fill="#6f6e6e">Signature</text>
    <path d="M34,500 c30,-30 50,10 80,-12 s40,20 70,-6 s30,10 60,-4" stroke="#201f1f" stroke-width="2.5" fill="none"/>
    <text x="${w - 34}" y="${h - 30}" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#6f6e6e">Expires ${2028 + (hash(ctx.seed) % 6)}-12-31</text>`);
}

function idBack(ctx: ArtCtx) {
  const w = 860, h = 540;
  const n = hash(ctx.seed);
  const bars = Array.from({ length: 70 }, (_, i) => `<rect x="${60 + i * 10.6}" y="120" width="${((n >> (i % 24)) & 3) + 2}" height="120" fill="#201f1f"/>`).join("");
  const name = `${ctx.last.toUpperCase()}<<${ctx.first.toUpperCase()}`.replace(/[^A-Z<]/g, "<");
  const mrz = [`IDNGA${"<".repeat(4)}••••••${"<".repeat(15)}`, `${ctx.dob.replace(/-/g, "").slice(2)}•M${2030 + (n % 5)}1231NGA<<<<<<<<<<<6`, `${name}${"<".repeat(Math.max(0, 30 - name.length))}`.slice(0, 30)];
  return svg(w, h, `
    <rect width="${w}" height="${h}" rx="28" fill="#f6f2ea"/>
    <rect y="40" width="${w}" height="54" fill="#201f1f" opacity=".85"/>
    ${bars}
    <text x="60" y="290" font-family="Arial, sans-serif" font-size="15" fill="#6f6e6e">Address on file</text>
    <text x="60" y="318" font-family="Arial, sans-serif" font-size="20" fill="#201f1f">${esc(ctx.address)}</text>
    <rect x="40" y="370" width="${w - 80}" height="130" rx="10" fill="#fff"/>
    ${mrz.map((l, i) => `<text x="60" y="${410 + i * 36}" font-family="Courier New, monospace" font-size="26" letter-spacing="3" fill="#201f1f">${esc(l)}</text>`).join("")}`);
}

function proofOfAddress(ctx: ArtCtx) {
  const w = 620, h = 820;
  const n = hash(ctx.seed);
  const row = (y: number, k: string, v: string) =>
    `<text x="48" y="${y}" font-family="Arial, sans-serif" font-size="16" fill="#6f6e6e">${esc(k)}</text><text x="${w - 48}" y="${y}" text-anchor="end" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#201f1f">${esc(v)}</text>`;
  return svg(w, h, `
    <rect width="${w}" height="${h}" fill="#fff"/>
    <rect width="${w}" height="110" fill="#1f4fa3"/>
    <text x="48" y="58" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">PHED</text>
    <text x="48" y="88" font-family="Arial, sans-serif" font-size="15" fill="#e6f4ff">Electricity bill · customer copy</text>
    <text x="48" y="168" font-family="Arial, sans-serif" font-size="15" fill="#6f6e6e">Billed to</text>
    <text x="48" y="196" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#201f1f">${esc(`${ctx.first} ${ctx.last}`)}</text>
    <text x="48" y="226" font-family="Arial, sans-serif" font-size="17" fill="#201f1f">${esc(ctx.address)}</text>
    <line x1="48" x2="${w - 48}" y1="262" y2="262" stroke="#ededed" stroke-width="2"/>
    ${row(304, "Account no.", `••••••${String(n % 10000).padStart(4, "0")}`)}
    ${row(344, "Meter no.", `${String(n % 1000).padStart(3, "0")}••••••${String((n >> 8) % 100).padStart(2, "0")}`)}
    ${row(384, "Billing period", "Sep 2026")}
    ${row(424, "Units consumed", `${120 + (n % 300)} kWh`)}
    <line x1="48" x2="${w - 48}" y1="458" y2="458" stroke="#ededed" stroke-width="2"/>
    ${row(500, "Amount due", `₦${(20000 + (n % 60000)).toLocaleString("en-NG")}.00`)}
    ${Array.from({ length: 6 }, (_, i) => `<rect x="48" y="${560 + i * 28}" width="${w - 96 - (i % 3) * 80}" height="10" rx="5" fill="#ededed"/>`).join("")}`);
}

export function renderKycSvg(kind: KycMediaKind, label: string, ctx: ArtCtx) {
  switch (kind) {
    case "bvn_photo":
    case "nin_photo":
      return portrait({ ...ctx, mismatch: false }, "front", "record");
    case "selfie":
      return portrait(ctx, "front", "Selfie · front camera");
    case "liveness_frame":
      return portrait(ctx, label.includes("blink") ? "blink" : "left", label.replace("Liveness frame · ", "Liveness · "));
    case "id_front":
      return idFront(ctx);
    case "id_back":
      return idBack(ctx);
    case "proof_of_address":
      return proofOfAddress(ctx);
  }
}
