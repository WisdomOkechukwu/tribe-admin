import type { NextRequest } from "next/server";
import { openStream } from "@/lib/api/client";
import { sessionFromCookie } from "@/lib/auth/current";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Server-Sent Events proxy: the browser can't hold the API token, so this
// route opens GET /admin-api/support-threads/stream with the token from the
// encrypted cookie and pipes the events through unchanged.
//
// The API sends `event: support` with {"type", "thread_id"} on every change
// and `: heartbeat` comments. If the stream route isn't live yet (404), we
// answer 204, which tells EventSource to stop retrying.
export async function GET(req: NextRequest) {
  const session = sessionFromCookie(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return new Response("Unauthorized", { status: 401 });

  let upstream: Response;
  try {
    upstream = await openStream("/support-threads/stream", session.token, req.signal);
  } catch {
    return new Response("Support stream unavailable", { status: 502 });
  }
  if (upstream.status === 404 || upstream.status === 405) return new Response(null, { status: 204 });
  if (!upstream.ok || !upstream.body) return new Response(upstream.statusText || "Support stream unavailable", { status: upstream.status === 401 ? 401 : upstream.status === 403 ? 403 : 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
