"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Toggle } from "@/components/ui/Toggle";
import { markSupportRead, replySupport, setSupportStatus, simulateSupport } from "@/lib/actions/admin";
import { unlockAudio } from "@/lib/sound";
import { useSupport } from "@/stores/support-store";
import { toast } from "@/stores/toast-store";

/** Demo controls: fire a new ticket or a customer chat reply, once or on a timer. */
export function SimulatePanel() {
  const [pending, start] = useTransition();
  const [auto, setAuto] = useState(false);
  const connected = useSupport((s) => s.connected);

  const fire = (kind: "ticket" | "reply") => {
    unlockAudio(); // the click is the user gesture browsers need for sound
    start(async () => {
      const r = await simulateSupport(kind);
      if (!r.ok) toast.error(r.message);
    });
  };

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => fire(Math.random() < 0.45 ? "ticket" : "reply"), 15_000);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <div className="card flex flex-wrap items-center gap-3 bg-warning-300 p-3 text-ink-900 [--edge:var(--color-ink-900)]">
      <span className="inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider">
        <span className={cx("size-2.5 rounded-full", connected ? "animate-pulse bg-success-500" : "bg-error-500")} aria-hidden />
        {connected ? "Live" : "Connecting…"} · Simulate
      </span>
      <Button size="sm" variant="ink" onClick={() => fire("ticket")} disabled={pending}><Icon name="ticket" size={14} /> New ticket</Button>
      <Button size="sm" variant="secondary" onClick={() => fire("reply")} disabled={pending}><Icon name="support" size={14} /> Customer replies</Button>
      <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold">
        <Toggle on={auto} onChange={(on) => { unlockAudio(); setAuto(on); }} label="Auto-simulate every 15 seconds" />
        Auto every 15s
      </label>
    </div>
  );
}

const QUICK = ["Looking into this now 👀", "Can you share a screenshot?", "Refund processed ✅ please check your wallet", "Escalated to our payments team, update within 24h"];

export function Composer({ threadId, disabled }: { threadId: string; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const box = useRef<HTMLTextAreaElement>(null);

  const send = (body = text) => {
    if (!body.trim()) return;
    start(async () => {
      const r = await replySupport(threadId, body);
      if (r.ok) {
        setText("");
        router.refresh();
      } else toast.error(r.message);
    });
  };

  return (
    <div className="border-t-2 border-edge bg-surface p-3">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {QUICK.map((q) => (
          <button key={q} type="button" disabled={disabled || pending} onClick={() => send(q)} className="pop shrink-0 cursor-pointer rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold disabled:opacity-50">
            {q}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={2}
          maxLength={2000}
          disabled={disabled}
          placeholder={disabled ? "Reopen the conversation to reply" : "Type a reply… (Enter to send, Shift+Enter for a new line)"}
          aria-label="Reply"
          className="min-h-11 flex-1 resize-none rounded-chip border-2 border-edge bg-surface px-3 py-2 text-[13px] outline-none focus:border-purple-500 focus-visible:outline-none disabled:opacity-60"
        />
        <Button type="submit" variant="primary" disabled={disabled || pending || !text.trim()} aria-label="Send reply">
          <Icon name="send" size={15} /> {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}

export function StatusButtons({ threadId, status }: { threadId: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (s: "open" | "pending" | "resolved") =>
    start(async () => {
      const r = await setSupportStatus(threadId, s);
      if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
    });
  return status === "resolved" ? (
    <Button size="sm" onClick={() => set("open")} disabled={pending}>Reopen</Button>
  ) : (
    <div className="flex gap-2">
      {status !== "pending" && <Button size="sm" onClick={() => set("pending")} disabled={pending}>Mark pending</Button>}
      <Button size="sm" variant="primary" onClick={() => set("resolved")} disabled={pending}>Resolve ✓</Button>
    </div>
  );
}

/** Clears the unread count once the admin actually opens the conversation. */
export function MarkRead({ threadId, unread }: { threadId: string; unread: number }) {
  useEffect(() => {
    if (unread > 0) void markSupportRead(threadId);
  }, [threadId, unread]);
  return null;
}

/** Keeps the newest message in view (scrolls the message pane, never the page). */
export function ScrollToEnd({ dep }: { dep: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const pane = ref.current?.parentElement;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [dep]);
  return <span ref={ref} />;
}
