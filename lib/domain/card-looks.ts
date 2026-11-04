// The card looks the mobile app can paint, ported from tribe-mobile
// (src/theme/card-finishes.ts and src/utils/card-finish.ts). The admin may only
// create designs whose key is listed here, and previews use these colours so a
// row in the table looks like the card in the app. Keep in step with the app.

export type CardThemeKey = "midnight" | "sunset" | "onyx" | "cream" | "lime" | "forest" | "sky";
export type CardPatternKey = "plain" | "lines" | "waves" | "dots" | "rings" | "stripes" | "grid" | "diamonds" | "orbits" | "contours" | "sparkles" | "daisies" | "hearts" | "zigzag";

/** What a finish paints on the card face. */
export type CardLook = {
  name: string;
  bg: string;
  /** main ink (network, holder) */
  fg: string;
  /** quiet ink (holder name) */
  sub: string;
  /** the Tribe wordmark's tint */
  mark: string;
  /** pattern ink, strong and soft (Solid: the sheen and the shade) */
  line: string;
  lineSoft: string;
  /** "brand" is Midnight's own logo stripes */
  pattern: CardPatternKey | "brand";
  /** a pale card: dark ink and a hairline edge */
  light: boolean;
};

// the app's palette values the presets use
const PURPLE = { 100: "#d1b4e5", 200: "#ba90d9", 500: "#690dac", 700: "#4b097a", 900: "#2c0548" } as const;
const ORANGE = { 50: "#ffefe9", 400: "#ff814d", 500: "#ff6220" } as const;
const WHITE = "#ffffff";
const INK = "#201f1f";
export const BRAND_STRIPES = [PURPLE[500], ORANGE[500]] as const;

export const CARD_PRESETS: Record<CardThemeKey, CardLook> = {
  midnight: { name: "Midnight", bg: PURPLE[900], fg: WHITE, sub: PURPLE[100], mark: ORANGE[400], line: PURPLE[500], lineSoft: ORANGE[500], pattern: "brand", light: false },
  sunset: { name: "Sunset", bg: ORANGE[500], fg: WHITE, sub: ORANGE[50], mark: WHITE, line: "rgba(255,255,255,0.42)", lineSoft: "rgba(255,255,255,0.2)", pattern: "rings", light: false },
  onyx: { name: "Onyx", bg: "#1E1C21", fg: WHITE, sub: "#B9B6BF", mark: PURPLE[200], line: "rgba(255,255,255,0.07)", lineSoft: "rgba(0,0,0,0.3)", pattern: "plain", light: false },
  cream: { name: "Cream", bg: "#EFEBE1", fg: "#201F1F", sub: "#6F6E6E", mark: PURPLE[500], line: "rgba(255,255,255,0.62)", lineSoft: "rgba(60,50,30,0.07)", pattern: "plain", light: true },
  lime: { name: "Lime", bg: "#BFEBA3", fg: "#14261A", sub: "#3D5A45", mark: PURPLE[700], line: "rgba(20,38,26,0.32)", lineSoft: "rgba(20,38,26,0.14)", pattern: "dots", light: true },
  forest: { name: "Forest", bg: "#0C3B2C", fg: WHITE, sub: "#A9D4C2", mark: "#BFEBA3", line: "rgba(191,235,163,0.45)", lineSoft: "rgba(191,235,163,0.2)", pattern: "lines", light: false },
  sky: { name: "Sky", bg: "#5AC8FA", fg: "#062A47", sub: "#0E4A75", mark: "#062A47", line: "rgba(255,255,255,0.72)", lineSoft: "rgba(255,255,255,0.34)", pattern: "waves", light: true },
};

/** The app's own order on the Finish step. */
export const CARD_THEME_ORDER: CardThemeKey[] = ["midnight", "sunset", "lime", "sky", "cream", "forest", "onyx"];

/** The app's curated colours (any other hue comes from its slider). */
export const CARD_SWATCHES: { name: string; hex: string }[] = [
  { name: "Coral", hex: "FF7A5C" },
  { name: "Rose", hex: "F4A6C0" },
  { name: "Berry", hex: "A3245E" },
  { name: "Cherry", hex: "C8102E" },
  { name: "Butter", hex: "F7D774" },
  { name: "Mint", hex: "9BE3C4" },
  { name: "Teal", hex: "0E7C74" },
  { name: "Ocean", hex: "1E4FD8" },
  { name: "Lilac", hex: "C7B3F5" },
  { name: "Plum", hex: "5A2A82" },
  { name: "Sand", hex: "D9C2A0" },
  { name: "Slate", hex: "4A5568" },
];

/** Every pattern the app can draw, with its name in the app. */
export const CARD_PATTERNS: { id: CardPatternKey; name: string }[] = [
  { id: "plain", name: "Solid" },
  { id: "lines", name: "Pinstripe" },
  { id: "waves", name: "Waves" },
  { id: "dots", name: "Dots" },
  { id: "rings", name: "Rings" },
  { id: "stripes", name: "Stripes" },
  { id: "grid", name: "Grid" },
  { id: "diamonds", name: "Diamonds" },
  { id: "orbits", name: "Orbits" },
  { id: "contours", name: "Contours" },
  { id: "sparkles", name: "Sparkles" },
  { id: "daisies", name: "Daisies" },
  { id: "hearts", name: "Hearts" },
  { id: "zigzag", name: "Zigzag" },
];

export const THEME_KEYS = CARD_THEME_ORDER as [CardThemeKey, ...CardThemeKey[]];
export const PATTERN_KEYS = CARD_PATTERNS.map((p) => p.id) as [CardPatternKey, ...CardPatternKey[]];

/** The pattern the app's "Make your own" starts on (swatch previews wear it). */
export const DEFAULT_CUSTOM_PATTERN: CardPatternKey = "waves";

export const isThemeKey = (v: unknown): v is CardThemeKey => typeof v === "string" && Object.prototype.hasOwnProperty.call(CARD_PRESETS, v);
export const isPatternKey = (v: unknown): v is CardPatternKey => typeof v === "string" && PATTERN_KEYS.includes(v as CardPatternKey);
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v);
export const cleanHex = (v: string) => v.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();

/** The id a design gets: `theme-sunset`, `swatch-FF7A5C`, `pattern-dots` (as the seeder makes them). */
export const designId = (kind: "theme" | "swatch" | "pattern", key: string) => `${kind}-${kind === "swatch" ? cleanHex(key) : key}`;

// ── colour helpers (same maths as the app's utils/color.ts) ──────────────────
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (x: number) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function hexToHsl(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.round(clamp(alpha) * 100) / 100})`;
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const bestInk = (bg: string, light: string, dark: string) => (contrast(bg, light) >= contrast(bg, dark) ? light : dark);

// hue buckets for naming a colour ("Deep teal", "Soft pink"), as the app names slider colours
const HUES: [number, string][] = [[14, "Red"], [40, "Orange"], [62, "Yellow"], [85, "Lime"], [150, "Green"], [182, "Teal"], [205, "Aqua"], [248, "Blue"], [272, "Indigo"], [312, "Violet"], [345, "Pink"], [361, "Red"]];

/** A curated swatch's name, or the plain description the app would give the colour. */
export function colourName(hex: string) {
  const h6 = cleanHex(hex);
  const swatch = CARD_SWATCHES.find((s) => s.hex === h6);
  if (swatch) return swatch.name;
  const { h, s, l } = hexToHsl(h6);
  if (s < 0.12) return l > 0.85 ? "Pearl" : l < 0.22 ? "Graphite" : "Grey";
  const hue = HUES.find(([max]) => h < max)?.[1] ?? "Red";
  return l >= 0.68 ? `Soft ${hue.toLowerCase()}` : l <= 0.34 ? `Deep ${hue.toLowerCase()}` : hue;
}

/** A "Make your own" card in this colour and pattern (the app's derive()). */
export function customLook(hex: string, pattern: CardPatternKey): CardLook {
  const bg = `#${cleanHex(hex).padEnd(6, "0")}`;
  const fg = bestInk(bg, WHITE, INK);
  const light = fg === INK;
  const ink =
    pattern === "plain"
      ? { line: withAlpha(WHITE, light ? 0.28 : 0.1), lineSoft: withAlpha("#000000", light ? 0.06 : 0.2) }
      : { line: withAlpha(fg, light ? 0.34 : 0.42), lineSoft: withAlpha(fg, light ? 0.15 : 0.2) };
  return { name: colourName(bg), bg, fg, sub: mix(bg, fg, 0.72), mark: fg, ...ink, pattern, light };
}

/**
 * A pattern on Midnight's colours, inked the way the app re-tunes a preset that wears another
 * pattern (the app's presetWith()). Stripes stay plain stripes here, not Midnight's logo bands,
 * so the row shows the pattern every other card gets.
 */
export function patternLook(pattern: CardPatternKey): CardLook {
  const base = CARD_PRESETS.midnight;
  const ink = pattern === "plain" ? { line: withAlpha(WHITE, 0.08), lineSoft: withAlpha("#000000", 0.25) } : { line: withAlpha(base.fg, 0.4), lineSoft: withAlpha(base.fg, 0.18) };
  return { ...base, ...ink, pattern, name: CARD_PATTERNS.find((p) => p.id === pattern)?.name ?? pattern };
}

/** The one field the app reads from a design row: a theme's finish, a swatch's colour, a pattern's id. */
export const designKey = (d: { kind: string; finish: string; hexColor: string | null; pattern: string | null }) => (d.kind === "theme" ? d.finish : d.kind === "swatch" ? (d.hexColor ?? "") : (d.pattern ?? ""));

/** The look a design row previews as, or null when the app can't render its key. */
export function designLook(kind: "theme" | "swatch" | "pattern", key: string | null | undefined): CardLook | null {
  if (kind === "theme") return isThemeKey(key) ? CARD_PRESETS[key] : null;
  if (kind === "pattern") return isPatternKey(key) ? patternLook(key) : null;
  return key && isHex(key) ? customLook(key, DEFAULT_CUSTOM_PATTERN) : null;
}

/** The name the app uses for a key (the editor's default name). */
export function knownName(kind: "theme" | "swatch" | "pattern", key: string): string {
  if (kind === "theme") return isThemeKey(key) ? CARD_PRESETS[key].name : "";
  if (kind === "pattern") return CARD_PATTERNS.find((p) => p.id === key)?.name ?? "";
  return isHex(key) ? colourName(key) : "";
}
