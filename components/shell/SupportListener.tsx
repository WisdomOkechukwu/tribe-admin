"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { playSound, unlockAudio } from "@/lib/sound";
import { useAccessStore } from "@/stores/access-store";
import { useSupport } from "@/stores/support-store";
import { toast } from "@/stores/toast-store";
import { useUi } from "@/stores/ui-store";

type Ev = { type: "ticket.new" | "chat.message" | "thread.updated"; threadId: string; customerName: string; subject: string; preview: string; unread: number };

/**
 * One SSE connection per tab. New tickets and customer chat replies play a
 * chime (if sound is on), show a toast with an Open link, update the unread
 * badge, and refresh the inbox if it's on screen.
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
    const es = new EventSource("/api/support/stream");
    const { setUnread, setConnected } = useSupport.getState();
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("error", () => setConnected(false));
    es.addEventListener("hello", (m) => setUnread(JSON.parse((m as MessageEvent).data).unread));
    es.addEventListener("support", (m) => {
      const e = JSON.parse((m as MessageEvent).data) as Ev;
      setUnread(e.unread);
      if (e.type !== "thread.updated") {
        if (useUi.getState().sound) playSound(e.type === "ticket.new" ? "ticket" : "chat");
        toast.support(e.type === "ticket.new" ? `New ticket · ${e.customerName}` : `${e.customerName} replied`, e.preview, `/support?t=${encodeURIComponent(e.threadId)}`);
      }
      if (window.location.pathname.startsWith("/support")) router.refresh();
    });
    return () => es.close();
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
