"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { throttleCheck, throttleFail, throttleReset } from "@/lib/auth/admins";
import { getUser, verifyLogin } from "@/lib/auth/users";
import { SESSION_COOKIE, SESSION_TTL_S, decodeSession, encodeSession, sessionCookieOptions } from "@/lib/auth/session";
import { recordAuth } from "@/lib/data/writes";

export type LoginState = { error?: string; email?: string };

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
  next: z.string().optional(),
});

/** Only same-origin relative paths; never "//evil.com" or absolute URLs. */
const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/");

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details.", email: String(formData.get("email") ?? "") };
  const { email, password, next } = parsed.data;

  const t = throttleCheck(email);
  if (t.blocked) return { error: `Too many attempts. Try again in ${t.retryInMin} min.`, email };

  const res = verifyLogin(email, password);
  if (!res.ok) {
    throttleFail(email);
    return { error: res.reason === "suspended" ? "This account is suspended. Ask a team manager to reactivate it." : "Email or password is incorrect.", email };
  }
  throttleReset(email);
  const admin = res.user;

  const token = encodeSession({ sub: admin.id, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  recordAuth(admin, "login");
  redirect(safeNext(next));
}

export async function logout() {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  const admin = session && getUser(session.sub);
  if (admin) recordAuth(admin, "logout");
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
