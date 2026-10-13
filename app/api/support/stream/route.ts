import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { unreadTotal } from "@/lib/data/writes";
import { userFromCookie } from "@/lib/auth/current";
import { subscribe } from "@/lib/support/bus";

// Server-Sent Events: pushes support events (new tickets, customer chat
// replies, read/resolve updates) to every signed-in admin tab.
export async function GET(req: NextRequest) {
  if (!userFromCookie(req.cookies.get(SESSION_COOKIE)?.value, "support.view")) return new Response("Forbidden", { status: 403 });

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send("hello", { unread: unreadTotal() });
      const off = subscribe((e) => send("support", e));
      const ping = setInterval(() => send("ping", {}), 25_000);
      cleanup = () => {
        off();
        clearInterval(ping);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
