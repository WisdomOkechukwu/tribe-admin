import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Clears a session the API no longer accepts (expired, revoked, suspended or
// removed account), then shows the reason on the login page. Rendering can't
// delete cookies; a route can.
const REASONS = ["expired", "suspended", "removed"] as const;

export function GET(req: NextRequest) {
  const r = req.nextUrl.searchParams.get("r");
  const reason = REASONS.find((x) => x === r) ?? "expired";
  const res = NextResponse.redirect(new URL(`/login?reason=${reason}`, req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
