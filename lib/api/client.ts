import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth/session";

// ─────────────────────────────────────────────────────────────────────────────
// Typed client for the Go admin API (tribe-backend, /admin-api).
//
// - The Go token lives in the encrypted httpOnly session cookie; it never
//   reaches the browser.
// - Success envelope: { success, message, data, meta }. Error envelope:
//   { success: false, message, code, errors }. Errors become ApiError, and
//   server actions turn them into ActionResult with toActionResult().
// - 401 (or a suspended account) signs the admin out.
// - Every write sends a fresh Idempotency-Key unless the caller passes one.
// ─────────────────────────────────────────────────────────────────────────────

export const API_URL = (process.env.TRIBE_API_URL ?? "http://localhost:8081").replace(/\/+$/, "");
const BASE = `${API_URL}/admin-api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** What every server action returns to the client. */
export type ActionResult = { ok: boolean; message: string; at?: number; code?: string; fieldErrors?: Record<string, string[]> };

type Query = Record<string, string | number | boolean | undefined | null>;
type Options = { query?: Query; body?: unknown; idempotencyKey?: string; token?: string; signal?: AbortSignal };
type Envelope<T> = { success: boolean; message?: string; code?: string; data?: T; meta?: unknown; errors?: Record<string, string[]> };

/** Clears the cookie (a route can, rendering can't) and shows the reason on /login. */
export function signOut(reason: "expired" | "suspended" | "removed" = "expired"): never {
  redirect(`/api/auth/signout?r=${reason}`);
}

export async function sessionToken() {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value)?.token ?? null;
}

function url(path: string, query?: Query) {
  const u = new URL(BASE + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  return u;
}

async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, opts: Options = {}): Promise<{ data: T; meta?: unknown; message: string }> {
  const token = opts.token ?? (await sessionToken());
  if (!token) signOut("expired");

  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${token}` };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["Idempotency-Key"] = opts.idempotencyKey ?? randomUUID();

  let res: Response;
  try {
    res = await fetch(url(path, opts.query), {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    unstable_rethrow(e);
    // An aborted request (navigation away, Next cancelling a render) isn't an outage.
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new ApiError(503, "API_UNREACHABLE", "Can't reach the Tribe API right now. Try again in a moment.");
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (res.status === 401) signOut("expired");
  if (res.status === 403 && body?.code === "SUSPENDED") signOut("suspended");
  if (!res.ok || !body || body.success === false) {
    throw new ApiError(res.status, body?.code ?? `HTTP_${res.status}`, body?.message ?? `The API answered ${res.status}.`, body?.errors);
  }
  return { data: body.data as T, meta: body.meta, message: body.message ?? "" };
}

export const get = async <T>(path: string, query?: Query) => (await request<T>("GET", path, { query })).data;
/** GET that also returns the envelope's `meta` (e.g. counts). */
export const getWithMeta = async <T, M = unknown>(path: string, query?: Query) => {
  const r = await request<T>("GET", path, { query });
  return { data: r.data, meta: (r.meta ?? null) as M | null };
};
export const post = <T = null>(path: string, body?: unknown, opts?: Omit<Options, "body">) => request<T>("POST", path, { ...opts, body: body ?? {} });
export const put = <T = null>(path: string, body?: unknown, opts?: Omit<Options, "body">) => request<T>("PUT", path, { ...opts, body: body ?? {} });
export const patch = <T = null>(path: string, body?: unknown, opts?: Omit<Options, "body">) => request<T>("PATCH", path, { ...opts, body: body ?? {} });
export const del = <T = null>(path: string, opts?: Options) => request<T>("DELETE", path, opts);

/** GET that turns 404 into null (missing record, or a route the backend hasn't shipped yet). */
export async function getOrNull<T>(path: string, query?: Query): Promise<T | null> {
  try {
    return await get<T>(path, query);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
}

/** What a page section's read resolves to: its data, or why it couldn't load (shown in that section only). */
export type SectionResult<D> = { ok: true; data: D } | { ok: false; message: string };

/** Runs a section read and never rejects (redirects and Next's own signals still pass through). */
export async function settle<D>(read: () => Promise<D>): Promise<SectionResult<D>> {
  try {
    return { ok: true, data: await read() };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("ACCESS_DENIED:")) return { ok: false, message: "You don't have access to this." };
    return { ok: false, message: toActionResult(e).message };
  }
}

/** Opens a raw streaming GET (SSE) with the given token. The caller owns the response body. */
export function openStream(path: string, token: string, signal?: AbortSignal) {
  return fetch(url(path), { headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` }, cache: "no-store", signal });
}

/** Maps any thrown error to the action result shape (lets redirects through). */
export function toActionResult(e: unknown): ActionResult {
  unstable_rethrow(e);
  if (e instanceof ApiError) {
    const first = e.errors ? Object.values(e.errors).flat()[0] : undefined;
    const message =
      e.code === "FOUR_EYES_REQUIRED" ? "A different admin must approve or reject your own request." :
      e.status === 404 && e.code === "HTTP_404" ? "This feature isn't available on the API yet." :
      first ?? e.message;
    return { ok: false, message, code: e.code, fieldErrors: e.errors, at: Date.now() };
  }
  return { ok: false, message: e instanceof Error ? e.message : "Something went wrong.", at: Date.now() };
}
