"use client";

// Tiny notification sounds synthesised with Web Audio: no audio files to load.
// Browsers only allow audio after a user gesture, so the context is unlocked
// on the first click/keypress anywhere in the console.
let ctx: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

export const audioReady = () => !!ctx && ctx.state === "running";

function note(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, peak = 0.18) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** "ticket": bright rising three-note chime. "chat": soft double pop. */
export function playSound(kind: "ticket" | "chat") {
  const c = context();
  if (!c) return false;
  if (c.state === "suspended") void c.resume();
  if (c.state !== "running") return false;
  const t = c.currentTime + 0.01;
  if (kind === "ticket") {
    note(c, 659.25, t, 0.18, "triangle"); // E5
    note(c, 987.77, t + 0.11, 0.2, "triangle"); // B5
    note(c, 1318.5, t + 0.22, 0.32, "sine", 0.14); // E6
  } else {
    note(c, 880, t, 0.09, "sine", 0.16); // A5
    note(c, 1174.66, t + 0.08, 0.14, "sine", 0.13); // D6
  }
  return true;
}
