import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { get } from "@/lib/api/client";
import { detectRole, normalisePerms, type AdminProfile, type Permission } from "@/lib/domain/permissions";
import { SESSION_COOKIE, decodeSession, type SessionPayload } from "./session";

// Who is signed in, and what they may do. The Go API is the source of truth:
// GET /admin-api/me returns the admin and their permissions (a suspended
// account or a revoked session answers 401/403 and the client signs out).

export class AccessDenied extends Error {
  constructor(public permission: Permission) {
    super(`ACCESS_DENIED:${permission}`);
  }
}

type GoAdmin = { id: string; name: string; email: string; color: string; status: string; permissions: string[] };

/** One /me call per request, shared by every gate and read on the page. */
const me = cache(async () => {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  const a = await get<GoAdmin>("/me");
  const perms = a.permissions as Permission[];
  return { admin: { id: a.id, name: a.name, email: a.email, role: detectRole(normalisePerms(perms)) } as AdminProfile, perms };
});

/**
 * Who is signed in (identity only), for rendering. Cached privately per
 * browser so prefetched App Shells carry it. Permissions are NOT taken from
 * here: they're read fresh by getAccess() so a change applies immediately.
 */
export async function getAdmin(): Promise<AdminProfile> {
  "use cache: private";
  return (await me()).admin;
}

export type Access = { admin: AdminProfile; perms: Permission[]; has: (p: Permission) => boolean };

/** Fresh permissions for the signed-in admin (suspension and edits apply on the next request). */
export async function getAccess(): Promise<Access> {
  const { admin, perms } = await me();
  const set = new Set<string>(perms);
  return { admin, perms, has: (p) => set.has(p) };
}

/** For data reads: throws AccessDenied (pages gate first, so users see a friendly screen). */
export async function requirePerm(p: Permission) {
  const a = await getAccess();
  if (!a.has(p)) throw new AccessDenied(p);
  return a;
}

/**
 * For server actions: re-reads the session and the admin's permissions from
 * the API on every call (never a cached value), then checks the permission.
 * The API checks it again on the write itself.
 */
export async function authorize(permission?: Permission): Promise<AdminProfile & { perms: Permission[] }> {
  const { admin, perms } = await me();
  if (permission && !perms.includes(permission)) throw new Error("You don't have permission to do that. Ask a team manager.");
  return { ...admin, perms };
}

/** For route handlers (SSE): the decoded session, or null. The API enforces permissions. */
export function sessionFromCookie(value: string | undefined): SessionPayload | null {
  return decodeSession(value);
}
