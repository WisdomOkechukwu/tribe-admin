import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ADMINS, type AdminProfile } from "@/lib/domain/admins";
import { ROLE_PRESETS, detectRole, normalisePerms, type AvatarColor, type Permission, type RoleId } from "@/lib/domain/permissions";

// The live team: who can sign in and exactly what they may see and do.
// In-memory (like the mock DB); swap for the real user store / IdP later.

export type TeamUser = AdminProfile & {
  permissions: Permission[];
  status: "active" | "suspended";
  color: AvatarColor;
  createdAt: string;
  createdBy?: string;
  lastLoginAt?: string;
  /** null = seeded account using the env/dev password. */
  password: { salt: string; hash: string } | null;
};

/** Safe shape for the UI: never includes password material. */
export type TeamMember = Omit<TeamUser, "password"> & { hasCustomPassword: boolean };

const DEV_PASSWORD = "Tribe@Admin2026";
const SEED_SALT = "tribe-admin-v1";
const presetPerms = (r: RoleId) => ROLE_PRESETS.find((p) => p.id === r)?.perms ?? [];

const g = globalThis as unknown as { __tribeTeam?: Map<string, TeamUser> };

function store() {
  if (!g.__tribeTeam) {
    g.__tribeTeam = new Map(
      ADMINS.map((a, i) => [
        a.id,
        { ...a, permissions: [...presetPerms(a.role)], status: a.status ?? "active", createdAt: new Date(Date.parse("2025-06-01T09:00:00Z") + i * 9 * 86_400_000).toISOString(), createdBy: i ? "adm_super" : undefined, password: null },
      ]),
    );
  }
  return g.__tribeTeam;
}

export const getUser = (id: string) => store().get(id);
export const getUserByEmail = (email: string) => [...store().values()].find((u) => u.email === email.trim().toLowerCase());
export const adminName = (id?: string) => (id ? store().get(id)?.name : undefined);
export const isActive = (id: string) => store().get(id)?.status === "active";

export function listMembers(): TeamMember[] {
  return [...store().values()].map(({ password, ...u }) => ({ ...u, hasCustomPassword: !!password }));
}

// ── Passwords ────────────────────────────────────────────────────────────────
function seedPassword(u: TeamUser) {
  const fromEnv = process.env[`ADMIN_PASSWORD_${u.role.toUpperCase()}`] ?? process.env.ADMIN_SEED_PASSWORD;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production" && process.env.TRIBE_ADMIN_ALLOW_DEV_SECRET !== "1") return null;
  return DEV_PASSWORD;
}

const seedHashes = new Map<string, Buffer | null>();

// `next dev` only: any password signs in to an existing account. Never true in a build.
const ANY_PASSWORD = true;

function matches(u: TeamUser, password: string) {
  if (ANY_PASSWORD) return true;
  if (u.password) {
    const attempt = scryptSync(password, u.password.salt, 32);
    return timingSafeEqual(attempt, Buffer.from(u.password.hash, "hex"));
  }
  if (!seedHashes.has(u.id)) {
    const pw = seedPassword(u);
    seedHashes.set(u.id, pw ? scryptSync(pw, SEED_SALT, 32) : null);
  }
  const stored = seedHashes.get(u.id);
  return !!stored && timingSafeEqual(scryptSync(password, SEED_SALT, 32), stored);
}

export function verifyLogin(email: string, password: string): { ok: true; user: TeamUser } | { ok: false; reason: "bad" | "suspended" } {
  const u = getUserByEmail(email);
  if (!u) {
    scryptSync(password, SEED_SALT, 32); // equalise timing for unknown emails
    return { ok: false, reason: "bad" };
  }
  if (!matches(u, password)) return { ok: false, reason: "bad" };
  if (u.status !== "active") return { ok: false, reason: "suspended" };
  u.lastLoginAt = new Date().toISOString();
  return { ok: true, user: u };
}

/** Readable one-time password, e.g. "plum-tiger-48-RX". */
export function generateTempPassword() {
  const words = ["plum", "tiger", "mango", "cobalt", "ember", "lagos", "zest", "nova", "pixel", "jollof", "kite", "orbit"];
  const b = randomBytes(6);
  return `${words[b[0] % words.length]}-${words[b[1] % words.length]}-${(b[2] % 90) + 10}-${String.fromCharCode(65 + (b[3] % 26))}${String.fromCharCode(65 + (b[4] % 26))}`;
}

function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: scryptSync(pw, salt, 32).toString("hex") };
}

// ── Mutations (callers authorise + audit) ────────────────────────────────────
export function createUser(input: { name: string; email: string; color: AvatarColor; permissions: string[] }, by: string) {
  const email = input.email.trim().toLowerCase();
  if (getUserByEmail(email)) throw new Error("Someone on the team already uses that email.");
  const permissions = normalisePerms(input.permissions);
  const password = generateTempPassword();
  const u: TeamUser = {
    id: `adm_${randomBytes(5).toString("hex")}`, name: input.name.trim(), email, role: detectRole(permissions), permissions,
    status: "active", color: input.color, createdAt: new Date().toISOString(), createdBy: by, password: hashPassword(password),
  };
  store().set(u.id, u);
  return { user: u, password };
}

export function updateUser(id: string, patch: { name?: string; color?: AvatarColor; permissions?: string[] }) {
  const u = store().get(id);
  if (!u) throw new Error("Teammate not found.");
  if (patch.name) u.name = patch.name.trim();
  if (patch.color) u.color = patch.color;
  if (patch.permissions) {
    u.permissions = normalisePerms(patch.permissions);
    u.role = detectRole(u.permissions);
  }
  return u;
}

export function setStatus(id: string, status: TeamUser["status"]) {
  const u = store().get(id);
  if (!u) throw new Error("Teammate not found.");
  u.status = status;
  return u;
}

export function resetPassword(id: string) {
  const u = store().get(id);
  if (!u) throw new Error("Teammate not found.");
  const password = generateTempPassword();
  u.password = hashPassword(password);
  return { user: u, password };
}

export function removeUser(id: string) {
  const u = store().get(id);
  if (!u) throw new Error("Teammate not found.");
  store().delete(id);
  return u;
}

/** Guardrail: the team must always keep at least one active manager. */
export function activeManagers(excludeId?: string) {
  return [...store().values()].filter((u) => u.id !== excludeId && u.status === "active" && u.permissions.includes("team.manage")).length;
}
