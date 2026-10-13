import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Clears a session whose account was suspended or removed, then shows the
// reason on the login page. (Rendering can't delete cookies; a route can.)
export function GET(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("r") === "removed" ? "removed" : "suspended";
  const res = NextResponse.redirect(new URL(`/login?reason=${reason}`, req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
