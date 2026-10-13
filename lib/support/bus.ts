import "server-only";

// In-process pub/sub for support events. Server actions publish; the SSE route
// (/api/support/stream) fans events out to every open admin tab.
// Production: replace with Redis pub/sub or the chat provider's webhooks.
export type SupportEvent = {
  type: "ticket.new" | "chat.message" | "thread.updated";
  threadId: string;
  customerName: string;
  subject: string;
  preview: string;
  unread: number;
};

type Listener = (e: SupportEvent) => void;
const g = globalThis as unknown as { __supportBus?: Set<Listener> };
const listeners = (g.__supportBus ??= new Set());

export function publish(e: SupportEvent) {
  for (const l of listeners) {
    try {
      l(e);
    } catch {
      /* a dead stream must not break the others */
    }
  }
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
