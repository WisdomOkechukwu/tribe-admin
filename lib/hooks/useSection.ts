"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import type { SectionResult } from "@/lib/api/client";

export type { SectionResult };
export type SectionParams<K extends string> = Partial<Record<K, string>>;
type Patch = Record<string, string | undefined>;

const EVENT = "tribe:section-params";
const FAILED: SectionResult<never> = { ok: false, message: "Couldn't load this section. Check your connection and try again." };
const keyOf = <K extends string>(keys: readonly K[], p: SectionParams<K>) => keys.map((k) => p[k] ?? "").join("\u0001");

/** Rewrites some URL params in place (history.replaceState: no server round trip, no history entry); every other param and the #hash stay. */
function writeUrl(patch: Patch) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Drives a section from elsewhere on the page (e.g. a vault card picking the movements' asset): writes the URL and the owning section follows. */
export function setUrlParams(patch: Patch) {
  writeUrl(patch);
  window.dispatchEvent(new CustomEvent<Patch>(EVENT, { detail: patch }));
}

/**
 * One self-contained page section: its own data, its own URL params, its own
 * loading state.
 *
 * - The server starts the first read and passes the (unawaited) promise as
 *   `initial`, so the section's chrome (tabs, filters) renders at once and its
 *   body streams in under <SectionBody>.
 * - `setParams` merges params, writes only this section's `urlKeys` into the
 *   URL (Next syncs replaceState into its router, so a later refresh() renders
 *   the same view), and calls only this section's loader (a server action) in
 *   a transition: the old body stays up, dimmed, until the new one is ready.
 *   No other section re-renders or refetches.
 * - Anything else on the page can drive it with setUrlParams().
 * - A server re-render (refresh() after a write, router.refresh()) hands down
 *   a new `initial`; that fresh data wins.
 */
export function useSection<K extends string, D>({ initial, initialParams, load, urlKeys }: {
  initial: Promise<SectionResult<D>>;
  initialParams: SectionParams<K>;
  load: (params: SectionParams<K>) => Promise<SectionResult<D>>;
  urlKeys: readonly K[];
}) {
  const [result, setResult] = useState(initial);
  const [params, setLocal] = useState(initialParams);
  const [pending, start] = useTransition();

  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setResult(initial);
    setLocal(initialParams);
  }

  const run = (next: SectionParams<K>) => {
    setLocal(next);
    start(() => setResult(load(next).catch(() => FAILED)));
  };

  const setParams = (patch: SectionParams<K>) => {
    const next = { ...params, ...patch };
    writeUrl(Object.fromEntries(urlKeys.map((k) => [k, next[k]])));
    run(next);
  };

  // Something else on the page set this section's keys: follow.
  const follow = useEffectEvent((patch: Patch) => {
    const mine = urlKeys.filter((k) => k in patch);
    if (!mine.length) return;
    const next = { ...params, ...Object.fromEntries(mine.map((k) => [k, patch[k]])) };
    if (keyOf(urlKeys, next) !== keyOf(urlKeys, params)) run(next);
  });
  useEffect(() => {
    const on = (e: Event) => follow((e as CustomEvent<Patch>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  return { result, params, setParams, pending };
}

export type Section<D> = { result: Promise<SectionResult<D>>; pending: boolean };
