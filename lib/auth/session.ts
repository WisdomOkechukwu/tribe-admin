import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless admin session: base64url(JSON payload) + "." + HMAC-SHA256.
// Used by proxy.ts (Node runtime) for the optimistic check and by the DAL /
// server actions for the real one.
export const SESSION_COOKIE = "tribe_admin";
export const SESSION_TTL_S = 8 * 60 * 60;

export type SessionPayload = { sub: string; exp: number };

const DEV_SECRET = "dev-only-insecure-tribe-admin-secret-change-me";

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production" && process.env.TRIBE_ADMIN_ALLOW_DEV_SECRET !== "1") {
    throw new Error("ADMIN_SESSION_SECRET must be set (32+ chars) in production.");
  }
  return DEV_SECRET;
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function encodeSession(p: SessionPayload) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof p.sub !== "string" || typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_S,
};
