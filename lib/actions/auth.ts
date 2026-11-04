"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { API_URL } from "@/lib/api/client";
import { SESSION_COOKIE, SESSION_TTL_S, decodeSession, encodeSession, sessionCookieOptions } from "@/lib/auth/session";
import { endSession } from "@/lib/data/writes";

export type LoginState = { error?: string; email?: string };

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
  next: z.string().optional(),
});

/** Only same-origin relative paths; never "//evil.com" or absolute URLs. */
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/");

type GoLogin = { admin: { id: string; name: string; email: string }; access_token: string; expires_at: string };

/** The Go admin API checks the password, throttles failures and audits the sign-in. */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details.", email: String(formData.get("email") ?? "") };
  const { email, password, next } = parsed.data;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin-api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { error: "Can't reach the Tribe API right now. Try again in a moment.", email };
  }
  const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string; code?: string; data?: GoLogin } | null;
  if (!res.ok || !body?.success || !body.data) {
    const message = body?.code === "INVALID_CREDENTIALS" ? "Email or password is incorrect." : body?.code === "SUSPENDED" ? "This account is suspended. Ask a team manager to reactivate it." : body?.message ?? "Sign-in failed.";
    return { error: message, email };
  }

  const go = body.data;
  const exp = Math.min(Math.floor(Date.parse(go.expires_at) / 1000) || Infinity, Math.floor(Date.now() / 1000) + SESSION_TTL_S);
  const session = encodeSession({ sub: go.admin.id, name: go.admin.name, email: go.admin.email, token: go.access_token, exp });
  (await cookies()).set(SESSION_COOKIE, session, sessionCookieOptions);
  redirect(safeNext(next));
}

export async function logout() {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  // Revoke the API session too (the API audits the sign-out). Best effort.
  if (session) await endSession(session.token).catch(() => null);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
