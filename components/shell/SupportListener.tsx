"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supportPulse, supportPulseMany } from "@/lib/actions/admin";
import { playSound, unlockAudio } from "@/lib/sound";
import { useAccessStore } from "@/stores/access-store";
import { useSupport } from "@/stores/support-store";
import { toast } from "@/stores/toast-store";
import { useUi } from "@/stores/ui-store";

/** What the Go API sends on `event: support`. */
type Ev = { type: "ticket.new" | "chat.message" | "thread.updated" | "thread.status" | string; thread_id: string };

/** Events closer together than this are handled as one burst. */
const BATCH_MS = 300;
/** At most this many toasts per burst (a flood of tickets shouldn't bury the screen). */
const MAX_TOASTS = 3;

/**
 * One SSE connection per tab (proxied from the Go API by /api/support/stream). Events are
 * batched: everything that arrives within 300 ms is handled together, with ONE thread-list read
 * (supportPulseMany) for the unread badge and the toasts, and ONE refresh of the inbox if it's on
 * screen. A new ticket or customer message chimes (if sound is on) and toasts with an Open link.
 */
export function SupportListener() {
  const router = useRouter();
  const allowed = useAccessStore((s) => (s.perms ? s.perms.has("support.view") : null));

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const { setUnread, setConnected } = useSupport.getState();
    let alive = true;
    void supportPulse().then((p) => alive && setUnread(p.unread));

    // the burst being collected: thread id -> the customer event that came in (if any)
    let batch = new Map<string, Ev["type"] | null>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      const events = batch;
      batch = new Map();
      if (!alive || events.size === 0) return;
      void supportPulseMany([...events.keys()]).then((p) => {
        if (!alive) return;
        setUnread(p.unread);
        const fromCustomer = [...events].filter(([, type]) => type === "ticket.new" || type === "chat.message");
        if (fromCustomer.length && useUi.getState().sound) playSound(fromCustomer.some(([, type]) => type === "ticket.new") ? "ticket" : "chat");
        for (const [threadId, type] of fromCustomer.slice(0, MAX_TOASTS)) {
          const t = p.threads[threadId];
          const who = t?.customerName ?? "A customer";
          toast.support(type === "ticket.new" ? `New ticket · ${who}` : `${who} replied`, t?.preview || t?.subject || "Open the inbox to read it.", `/support?t=${encodeURIComponent(threadId)}`);
        }
        if (fromCustomer.length > MAX_TOASTS) toast.support(`${fromCustomer.length - MAX_TOASTS} more conversations`, "Open the inbox to see them all.", "/support");
      });
      if (window.location.pathname.startsWith("/support")) router.refresh();
    };

    const es = new EventSource("/api/support/stream");
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("error", () => setConnected(false));
    es.addEventListener("support", (m) => {
      let e: Ev;
      try {
        e = JSON.parse((m as MessageEvent).data) as Ev;
      } catch {
        return;
      }
      const customer = e.type === "ticket.new" || e.type === "chat.message";
      // keep the customer event for the thread if any event in the burst was one ("ticket.new" wins)
      const had = batch.get(e.thread_id);
      batch.set(e.thread_id, had === "ticket.new" ? had : customer ? e.type : (had ?? null));
      if (!timer) timer = setTimeout(flush, BATCH_MS);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      es.close();
    };
  }, [router, allowed]);

  return null;
}

export function SoundToggle() {
  const sound = useUi((s) => s.sound);
  const setSound = useUi((s) => s.setSound);
  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio();
        setSound(!sound);
        if (!sound) playSound("chat");
      }}
      className="pop grid size-9 cursor-pointer place-items-center rounded-full bg-surface"
      aria-label={sound ? "Mute support sounds" : "Unmute support sounds"}
      aria-pressed={sound}
      title={sound ? "Sound on" : "Sound off"}
      suppressHydrationWarning
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        {!sound && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}
