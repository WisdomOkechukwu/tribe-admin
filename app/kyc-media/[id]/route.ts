import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { userFromCookie } from "@/lib/auth/current";
import { kycMediaSvg } from "@/lib/kyc/media";

// KYC images are sensitive: only signed-in admins get them, never cached by
// shared caches, and the SVG is sandboxed (no scripts, no external loads).
// Production: stream the file from QoreID / object storage here instead.
export async function GET(req: NextRequest, ctx: RouteContext<"/kyc-media/[id]">) {
  if (!userFromCookie(req.cookies.get(SESSION_COOKIE)?.value, "kyc.media")) return new Response("Forbidden", { status: 403 });

  const { id } = await ctx.params;
  const body = /^med_[a-z0-9]{6,20}$/.test(id) ? kycMediaSvg(id) : null;
  if (!body) return new Response("Not found", { status: 404 });

  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
