import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminProfile } from "@/lib/domain/admins";
import type { Permission } from "@/lib/domain/permissions";
import { SESSION_COOKIE, decodeSession } from "./session";
import { getUser } from "./users";

/** No cookie → login. Valid cookie but account gone/suspended → clear it first (else proxy and page loop). */
function bounce(session: unknown, u: { status: string } | undefined): never {
  if (!session) redirect("/login");
  redirect(`/api/auth/signout?r=${u ? "suspended" : "removed"}`);
}

export class AccessDenied extends Error {
  constructor(public permission: Permission) {
    super(`ACCESS_DENIED:${permission}`);
  }
}

/**
 * Who is signed in (identity only), for rendering. Cached privately per
 * browser so prefetched App Shells carry it. Permissions are NOT taken from
 * here: they're read fresh by getAccess() so a change applies immediately.
 */
export async function getAdmin(): Promise<AdminProfile> {
  "use cache: private";
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const u = session ? getUser(session.sub) : undefined;
  if (!u || u.status !== "active") bounce(session, u);
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export type Access = { admin: AdminProfile; perms: Permission[]; has: (p: Permission) => boolean };

/** Fresh permissions for the signed-in admin (suspension and edits apply on the next request). */
export async function getAccess(): Promise<Access> {
  const me = await getAdmin();
  const u = getUser(me.id);
  if (!u || u.status !== "active") bounce(true, u);
  const set = new Set(u.permissions);
  return { admin: { id: u.id, name: u.name, email: u.email, role: u.role }, perms: u.permissions, has: (p) => set.has(p) };
}

/** For data reads: throws AccessDenied (pages gate first, so users see a friendly screen). */
export async function requirePerm(p: Permission) {
  const a = await getAccess();
  if (!a.has(p)) throw new AccessDenied(p);
  return a;
}

/**
 * For server actions: re-reads and verifies the cookie on every call (never
 * trusts a cached value), checks the account is active, then the permission.
 */
export async function authorize(permission?: Permission): Promise<AdminProfile & { perms: Permission[] }> {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const u = session ? getUser(session.sub) : undefined;
  if (!u || u.status !== "active") bounce(session, u);
  if (permission && !u.permissions.includes(permission)) {
    throw new Error("You don't have permission to do that. Ask a team manager.");
  }
  return { id: u.id, name: u.name, email: u.email, role: u.role, perms: u.permissions };
}

/** For route handlers (SSE, KYC media): cookie → active user with the permission, or null. */
export function userFromCookie(value: string | undefined, permission?: Permission) {
  const session = decodeSession(value);
  const u = session ? getUser(session.sub) : undefined;
  if (!u || u.status !== "active") return null;
  if (permission && !u.permissions.includes(permission)) return null;
  return u;
}
