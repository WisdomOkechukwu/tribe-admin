"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { NAV } from "./nav";

/**
 * Non-blocking navigation progress: a striped bar across the top the moment a
 * link is clicked, plus a "Loading X…" pill if it takes longer than 400ms.
 * Finishes when Next commits the new route, observed through usePathname /
 * useSearchParams (never by patching window.history, which Next calls from
 * inside useInsertionEffect, where state updates are forbidden).
 */
export function NavProgress() {
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const [label, setLabel] = useState("");
  const [slow, setSlow] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const finish = () => {
    clear();
    setPhase((p) => (p === "run" ? "done" : p));
    setSlow(false);
    timers.current.push(setTimeout(() => setPhase("idle"), 380));
  };

  const start = (url: URL) => {
    clear();
    const hit = NAV.find((n) => n.match(url.pathname));
    setLabel(url.pathname.startsWith("/transactions/") ? "transaction" : url.pathname.split("/").length > 2 && url.pathname.startsWith("/customers/") ? "customer" : hit?.label ?? "page");
    setSlow(false);
    setPhase("run");
    timers.current.push(setTimeout(() => setSlow(true), 400));
    timers.current.push(setTimeout(finish, 10_000)); // safety net
  };

  // Stable handler for the document listener that always sees the latest closures.
  const onLinkClick = useEffectEvent((e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a");
    if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith("/api") || url.pathname.startsWith("/kyc-media")) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    start(url);
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => onLinkClick(e);
    document.addEventListener("click", handler, true);
    return () => {
      document.removeEventListener("click", handler, true);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      {/* useSearchParams needs a Suspense boundary on dynamic routes. */}
      <Suspense fallback={null}>
        <RouteWatcher onChange={finish} />
      </Suspense>
      {phase !== "idle" && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1" aria-hidden>
            <div
              className="stripes h-full animate-[nav-stripes_0.6s_linear_infinite] [--stripe-w:10px]"
              style={{ width: phase === "done" ? "100%" : "82%", opacity: phase === "done" ? 0 : 1, transition: phase === "done" ? "width 180ms ease, opacity 300ms ease 120ms" : "width 2.4s cubic-bezier(.1,.7,.2,1)" }}
            />
          </div>
          {slow && phase === "run" && (
            <div role="status" className="pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 animate-[toast-in_160ms_ease-out] lg:left-[calc(50%+128px)]">
              <span className="inline-flex items-center gap-2.5 rounded-full border-2 border-edge bg-surface py-1.5 pr-4 pl-2 text-[12.5px] font-bold shadow-hard-sm">
                <Coins />
                Loading {label}…
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Fires onChange after Next commits a new pathname or query (from a normal effect). */
function RouteWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const fire = useEffectEvent(onChange);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    fire();
  }, [pathname, search]);
  return null;
}

export function Coins() {
  return (
    <span className="inline-flex items-end gap-1" aria-hidden>
      {["bg-purple-500", "bg-orange-500", "bg-warning-300"].map((c, i) => (
        <span key={c} className={`size-2.5 animate-[coin_0.9s_ease-in-out_infinite] rounded-full border border-edge ${c}`} style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}
