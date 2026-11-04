import { BRAND_STRIPES, type CardLook } from "@/lib/domain/card-looks";
import { cx } from "@/components/ui/cx";

// The app's card face (tribe-mobile src/components/card-face.tsx), drawn as one SVG
// in the same fixed 340×214 box. Patterns are ported path for path, so a preview
// here is the card a customer sees. No ids (clipping uses a nested <svg>), so it
// renders on the server and many copies can share a page.

const VW = 340;
const VH = 214;
const RATIO = 1.586;

// Pinstripe: hairlines leaning like the logo's bands, fading in towards the right
const PINSTRIPES = ["", "", ""];
for (let x = 92; x <= VW + 8; x += 9) PINSTRIPES[x < 170 ? 0 : x < 250 ? 1 : 2] += `M${x} ${VH}L${x + 134} 0`;

// Waves: six slow S-curves across the lower half
let WAVES = "";
for (let i = 0; i < 6; i++) {
  const y = 108 + 19 * i;
  const a = 24 * (1 - 0.1 * i);
  WAVES += `M-10 ${y}C80 ${y - a} 170 ${y + a} 260 ${y}S350 ${y - a / 2} 360 ${y - a / 2}`;
}

// Dots: a halftone pouring out of the top-right corner
let DOTS = "";
for (let row = 0, y = 4; y <= VH + 6; y += 12, row++)
  for (let x = VW + 4 - (row % 2) * 7; x >= 60; x -= 14) {
    const r = 5.2 * (1 - Math.hypot(VW - x, y * 1.25) / 300);
    if (r >= 0.6) DOTS += `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }

// Rings: ripples spreading from the bottom-right corner
const RINGS = Array.from({ length: 6 }, (_, i) => ({ r: 46 + 36 * i, opacity: 1 - i * 0.1 }));

// Grid: graph paper over the right side in five fading bands, a few cells filled in
const CELL = 22;
const GRID_X = VW - CELL * 10;
const GRID = Array.from({ length: 5 }, (_, band) => {
  const x0 = GRID_X + band * CELL * 2;
  const x1 = Math.min(x0 + CELL * 2, VW);
  let d = "";
  for (let x = x0; x < x1; x += CELL) d += `M${x} 0V${VH}`;
  for (let y = 0; y <= VH; y += CELL) d += `M${x0} ${y}H${x1}`;
  return d;
});
const GRID_FILL = [[9, 0], [8, 1], [9, 2], [7, 0], [6, 2], [8, 3], [9, 5], [5, 1], [7, 4], [4, 0]]
  .map(([col, row]) => `M${GRID_X + col * CELL} ${row * CELL}h${CELL}v${CELL}h${-CELL}z`)
  .join("");

// Diamonds: crossing diagonals across the whole card
let DIAMONDS = "";
for (let x = -VH; x <= VW; x += 26) DIAMONDS += `M${x} 0L${x + VH} ${VH}M${x} ${VH}L${x + VH} 0`;

// Orbits: off-centre circles from the top-right, one small planet on the third
const ORBITS = Array.from({ length: 5 }, (_, i) => ({ cx: 300 - i * 14, cy: 26 + i * 10, r: 38 + 36 * i, opacity: 1 - i * 0.12 }));
const PLANET = { cx: ORBITS[2].cx - ORBITS[2].r * Math.cos(0.5), cy: ORBITS[2].cy + ORBITS[2].r * Math.sin(0.5) };

// Contours: a topographic hill rising from the bottom edge
const CONTOUR_C = { x: 210, y: VH - 6 };
const CONTOURS = Array.from({ length: 7 }, (_, i) => ({ rx: 30 + 27 * i, ry: 18 + 18 * i, opacity: 1 - i * 0.08 }));

// Sparkles: four-point stars, big to tiny
const SPARKLES = [[298, 56, 36], [234, 130, 17], [326, 162, 21], [190, 44, 13], [166, 184, 16], [122, 102, 9], [274, 198, 10], [238, 70, 8], [334, 104, 9], [146, 30, 6]]
  .map(([x, y, r]) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`)
  .join("");

// Daisies: six round petals around a hollow centre
const DAISIES = [
  { x: 296, y: 50, r: 56, rot: 10 },
  { x: 210, y: 170, r: 38, rot: 30 },
  { x: 336, y: 182, r: 30, rot: 0 },
  { x: 172, y: 62, r: 21, rot: 20 },
  { x: 118, y: 206, r: 22, rot: 15 },
].map((d) => ({
  ...d,
  petals: Array.from({ length: 6 }, (_, i) => {
    const a = ((d.rot + i * 60) * Math.PI) / 180;
    return { cx: d.x + Math.cos(a) * d.r * 0.58, cy: d.y + Math.sin(a) * d.r * 0.58, deg: d.rot + i * 60 };
  }),
}));

// Hearts: a few filled, a few outlined, all slightly off-kilter
const heart = (x: number, y: number, s: number) =>
  `M${x} ${y + 0.4 * s}C${x - 0.95 * s} ${y - 0.2 * s} ${x - 0.5 * s} ${y - 0.95 * s} ${x} ${y - 0.42 * s}C${x + 0.5 * s} ${y - 0.95 * s} ${x + 0.95 * s} ${y - 0.2 * s} ${x} ${y + 0.4 * s}Z`;
const HEARTS = [
  { x: 292, y: 66, s: 56, rot: -14, fill: true },
  { x: 212, y: 164, s: 36, rot: 12, fill: false },
  { x: 332, y: 178, s: 28, rot: -6, fill: true },
  { x: 178, y: 52, s: 22, rot: 18, fill: false },
  { x: 136, y: 190, s: 17, rot: -10, fill: true },
  { x: 250, y: 112, s: 14, rot: 6, fill: false },
];

// Zigzag: chunky chevrons over the right side, strong and soft in turn
const ZIGZAGS = Array.from({ length: 6 }, (_, i) => {
  const y = 22 + i * 34;
  const x0 = 136 + (i % 3) * 16;
  let d = `M${x0} ${y}`;
  for (let x = x0, up = true; x < VW + 14; x += 16, up = !up) d += `L${x + 16} ${up ? y - 12 : y}`;
  return d;
});

/**
 * The logo's diagonal bands (the app's <Stripes> inside a 72%×160% box past the top-right
 * corner), as bands rotated -32° about the box centre, clipped by a nested <svg>.
 */
function StripesArt({ look }: { look: CardLook }) {
  const brand = look.pattern === "brand";
  const band = brand ? 20 : 15;
  const gap = brand ? 9 : 8;
  const count = brand ? 10 : 9;
  const colors = brand ? BRAND_STRIPES : [look.line, look.lineSoft];
  // the clipping box, in card units (right: -30, top: -40, 72% wide, 160% tall)
  const bw = VW * 0.72;
  const bh = VH * 1.6;
  const bx = VW + 30 - bw;
  const by = -40;
  // the stripes' own frame: 220% of the box, offset -60%, rotated about its centre
  const fw = bw * 2.2;
  const fx = -bw * 0.6;
  const cx = fx + fw / 2;
  const cy = -bh * 0.6 + (bh * 2.2) / 2;
  const total = count * band + (count - 1) * gap;
  return (
    <svg x={bx} y={by} width={bw} height={bh} overflow="hidden" opacity={brand ? 0.9 : 1}>
      <g transform={`rotate(-32 ${cx} ${cy})`}>
        {Array.from({ length: count }, (_, i) => (
          <rect key={i} x={fx} y={cy - total / 2 + i * (band + gap)} width={fw} height={band} fill={colors[i % colors.length]} />
        ))}
      </g>
    </svg>
  );
}

function PatternArt({ look, k }: { look: CardLook; k: number }) {
  // keep every line ≥ ~1px on screen, as the app does for small thumbs
  const w = (sw: number) => sw * Math.max(1, 1 / (sw * k));
  switch (look.pattern) {
    case "brand":
    case "stripes":
      return <StripesArt look={look} />;
    case "plain":
      return (
        <>
          <circle cx={300} cy={10} r={170} fill={look.line} />
          <circle cx={20} cy={240} r={130} fill={look.lineSoft} />
        </>
      );
    case "lines":
      return <>{PINSTRIPES.map((d, i) => <path key={i} d={d} stroke={look.line} strokeWidth={w(1.4)} opacity={0.55 + i * 0.225} fill="none" />)}</>;
    case "waves":
      return <path d={WAVES} stroke={look.line} strokeWidth={w(1.9)} fill="none" strokeLinecap="round" />;
    case "dots":
      return <path d={DOTS} fill={look.line} />;
    case "grid":
      return (
        <g>
          <path d={GRID_FILL} fill={look.lineSoft} />
          {GRID.map((d, i) => <path key={i} d={d} stroke={look.line} strokeWidth={w(1.4)} opacity={0.14 + i * 0.215} fill="none" />)}
        </g>
      );
    case "diamonds":
      return <path d={DIAMONDS} stroke={look.line} strokeWidth={w(1.2)} opacity={0.85} fill="none" />;
    case "orbits":
      return (
        <g>
          {ORBITS.map((o) => <circle key={o.r} cx={o.cx} cy={o.cy} r={o.r} stroke={look.line} strokeWidth={w(1.7)} opacity={o.opacity} fill="none" />)}
          <circle cx={PLANET.cx} cy={PLANET.cy} r={6} fill={look.line} />
        </g>
      );
    case "contours":
      return (
        <g transform={`rotate(-12 ${CONTOUR_C.x} ${CONTOUR_C.y})`}>
          {CONTOURS.map((c) => <ellipse key={c.rx} cx={CONTOUR_C.x} cy={CONTOUR_C.y} rx={c.rx} ry={c.ry} stroke={look.line} strokeWidth={w(1.6)} opacity={c.opacity} fill="none" />)}
        </g>
      );
    case "sparkles":
      return <path d={SPARKLES} fill={look.line} />;
    case "daisies":
      return (
        <>
          {DAISIES.map((d) => (
            <g key={d.x}>
              {d.petals.map((p) => <ellipse key={p.deg} cx={p.cx} cy={p.cy} rx={d.r * 0.4} ry={d.r * 0.24} transform={`rotate(${p.deg} ${p.cx} ${p.cy})`} fill={look.line} />)}
              <circle cx={d.x} cy={d.y} r={d.r * 0.3} fill={look.bg} />
              <circle cx={d.x} cy={d.y} r={d.r * 0.3} fill={look.lineSoft} stroke={look.line} strokeWidth={w(1.4)} />
            </g>
          ))}
        </>
      );
    case "hearts":
      return (
        <>
          {HEARTS.map((h) => (
            <path key={h.x} d={heart(h.x, h.y, h.s)} transform={`rotate(${h.rot} ${h.x} ${h.y})`} fill={h.fill ? look.line : "none"} stroke={h.fill ? "none" : look.line} strokeWidth={w(2.2)} strokeLinejoin="round" />
          ))}
        </>
      );
    case "zigzag":
      return <>{ZIGZAGS.map((d, i) => <path key={i} d={d} stroke={i % 2 ? look.lineSoft : look.line} strokeWidth={w(6)} strokeLinejoin="miter" fill="none" />)}</>;
    case "rings":
      return (
        <g>
          <circle cx={330} cy={VH} r={46} fill={look.lineSoft} />
          {RINGS.map((ring) => <circle key={ring.r} cx={330} cy={VH} r={ring.r} stroke={look.line} strokeWidth={w(2)} opacity={ring.opacity} fill="none" />)}
        </g>
      );
  }
}

/**
 * A card in a finish, as the app paints it. Small (`face` off) it's the app's CardThumb:
 * colour and pattern only. With `face` it's the full card: Tribe wordmark top-left, holder
 * bottom-left, Mastercard bottom-right. `look` null draws an empty dashed card (unknown key).
 */
export function CardPreview({ look, width = 72, face = false, holder = "ADA OKAFOR", className }: { look: CardLook | null; width?: number; face?: boolean; holder?: string; className?: string }) {
  const height = Math.round(width / RATIO);
  const k = width / VW;
  // the app: thumbs round to max(4, w·10%), full faces to min(22, w·6.5%)
  const radius = face ? Math.min(22, width * 0.065) : Math.max(4, width * 0.1);
  if (!look) {
    return <span className={cx("inline-block shrink-0 border-2 border-dashed border-line bg-sunken", className)} style={{ width, height, borderRadius: radius }} aria-hidden />;
  }
  const pad = 20 * k;
  const mark = 15 * k * 2.6;
  return (
    <span
      className={cx("relative inline-block shrink-0 overflow-hidden align-middle", className)}
      style={{ width, height, borderRadius: radius, background: look.bg, boxShadow: look.light ? "inset 0 0 0 1px rgba(0,0,0,0.08)" : undefined }}
      role="img"
      aria-label={`${look.name} card`}
    >
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <PatternArt look={look} k={k} />
      </svg>
      {face && (
        <>
          {/* the app tints the logo (Africa + TRIBE) to the card's mark ink */}
          <span
            className="absolute"
            style={{ left: pad, top: pad, width: mark, height: mark, background: look.mark, maskImage: "url(/brand/tribe-logo.png)", WebkitMaskImage: "url(/brand/tribe-logo.png)", maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }}
            aria-hidden
          />
          {width >= 220 && (
            <span className="absolute font-medium tracking-[1px]" style={{ left: pad, bottom: pad, fontSize: Math.max(9, 11 * k), lineHeight: `${Math.max(12, 15 * k)}px`, color: look.sub }} aria-hidden>
              {holder}
            </span>
          )}
          <span className="absolute flex" style={{ right: pad, bottom: pad }} aria-hidden>
            <span className="rounded-full" style={{ width: 34 * k * 0.62, height: 34 * k * 0.62, background: "#EB001B" }} />
            <span className="rounded-full" style={{ width: 34 * k * 0.62, height: 34 * k * 0.62, background: "#F79E1B", marginLeft: -34 * k * 0.62 * 0.38, opacity: 0.92 }} />
          </span>
        </>
      )}
    </span>
  );
}
