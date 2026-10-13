import "server-only";

// Naive in-memory login throttle: 5 failed attempts per email per 15 minutes.
const WINDOW = 15 * 60_000;
const LIMIT = 5;
const attempts = new Map<string, { count: number; first: number }>();

export function throttleCheck(email: string, now = Date.now()) {
  const key = email.trim().toLowerCase();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW) return { blocked: false, retryInMin: 0 };
  return { blocked: a.count >= LIMIT, retryInMin: Math.ceil((a.first + WINDOW - now) / 60_000) };
}

export function throttleFail(email: string, now = Date.now()) {
  const key = email.trim().toLowerCase();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW) attempts.set(key, { count: 1, first: now });
  else a.count += 1;
}

export const throttleReset = (email: string) => attempts.delete(email.trim().toLowerCase());
