import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth/session";

// Optimistic gate: verifies the signed cookie only (no data lookups). Every
// page's data and every server action re-checks the session itself.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authed = decodeSession(request.cookies.get(SESSION_COOKIE)?.value) !== null;
  const onLogin = pathname === "/login";

  if (!authed && !onLogin) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (authed && onLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|logos/|.*\\.(?:png|svg|jpg|webp|ico)$).*)"],
};
