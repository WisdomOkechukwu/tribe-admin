import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Admin session cookie: AES-256-GCM encrypted JSON (iv.tag.ciphertext,
// base64url). It holds the Go admin API token, so it must never be readable
// by the browser (httpOnly) or by anyone without ADMIN_SESSION_SECRET.
// Used by proxy.ts (Node runtime) for the optimistic check and by the DAL /
// server actions / API client for the real one.
export const SESSION_COOKIE = "tribe_admin";
export const SESSION_TTL_S = 8 * 60 * 60;

/** sub = Go admin id; token = Go access token; exp = unix seconds. */
export type SessionPayload = { sub: string; name: string; email: string; token: string; exp: number };

const DEV_SECRET = "dev-only-insecure-tribe-admin-secret-change-me";

function key() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32) return createHash("sha256").update(s).digest();
  if (process.env.NODE_ENV === "production" && process.env.TRIBE_ADMIN_ALLOW_DEV_SECRET !== "1") {
    throw new Error("ADMIN_SESSION_SECRET must be set (32+ chars) in production.");
  }
  return createHash("sha256").update(DEV_SECRET).digest();
}

export function encodeSession(p: SessionPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(p), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

/**
 * Decrypts the cookie. Pass `now` (ms) to also reject an expired session; the
 * proxy does. Server code skips it (no clock reads while prerendering): the
 * API refuses an expired token with 401, which signs the admin out.
 */
export function decodeSession(value: string | undefined, now?: number): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, body] = parts.map((p) => Buffer.from(p, "base64url"));
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    const p = JSON.parse(json) as SessionPayload;
    if (typeof p.sub !== "string" || typeof p.token !== "string" || typeof p.exp !== "number" || (now !== undefined && p.exp * 1000 < now)) return null;
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
