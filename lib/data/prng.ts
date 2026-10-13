// Seeded PRNG so the mock dataset is identical on every boot, in build
// prerender and at runtime (no Math.random() during render).
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof makeRng>;

export function makeRng(seed: number) {
  const next = mulberry32(seed);
  const draw = (n: number, chars: string) => {
    let out = "";
    for (let i = 0; i < n; i++) out += chars[(next() * chars.length) | 0];
    return out;
  };
  const rng = {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number) => next() * (max - min) + min,
    chance: (p: number) => next() < p,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    /** Weighted pick: [[value, weight], …]. */
    weighted: <T,>(pairs: readonly (readonly [T, number])[]): T => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of pairs) {
        if ((r -= w) <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
    digits: (n: number) => draw(n, "0123456789"),
    alnum: (n: number) => draw(n, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"),
    hex: (n: number) => draw(n, "0123456789abcdef"),
    sample: <T,>(arr: readonly T[], k: number): T[] => {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, k);
    },
    /** Log-normal-ish amount between min and max, skewed small. */
    amount: (min: number, max: number) => {
      const u = next() ** 2.2;
      return min + u * (max - min);
    },
  };
  return rng;
}
