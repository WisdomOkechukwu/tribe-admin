// Parse Next's searchParams into plain, cache-key-friendly filter values.
export type SP = Record<string, string | string[] | undefined>;

export const str = (sp: SP, k: string, max = 120): string | undefined => {
  const v = sp[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.slice(0, max) : undefined;
};

export const oneOf = <T extends string>(sp: SP, k: string, allowed: readonly T[]): T | undefined => {
  const v = str(sp, k);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
};

export const pageOf = (sp: SP) => {
  const n = Number(str(sp, "page"));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
};

export const isoDay = (sp: SP, k: string) => {
  const v = str(sp, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
};

/** Current params as a flat record for building pagination/tab links. */
export const flat = (sp: SP, keys: string[]) => Object.fromEntries(keys.map((k) => [k, str(sp, k)]));
