import "server-only";
import { buildDb, type Db } from "./seed";

// In-memory mock database. Lives on globalThis so dev HMR doesn't reseed it.
// Writes (top-ups, markups, KYC decisions…) last until the server restarts.
// Swap lib/data/repo.ts for real API calls; nothing else touches this module.
// Bump when the seed's shape changes so a running dev server reseeds instead
// of serving objects from the previous shape.
const SEED_VERSION = 8;
const g = globalThis as unknown as { __tribeAdminDb?: Db & { __v?: number } };

export function db(): Db {
  if (g.__tribeAdminDb?.__v !== SEED_VERSION) g.__tribeAdminDb = Object.assign(buildDb(), { __v: SEED_VERSION });
  return g.__tribeAdminDb;
}

export function nextId(prefix: string) {
  const d = db();
  d.seq += 1;
  return `${prefix}_${Date.now().toString(36)}${d.seq.toString(36)}`;
}
