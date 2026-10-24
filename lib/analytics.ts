export type Door = "discover" | "experience";
export const CONSENT_KEY = "nexo.stats.consent.v1";
export const SESSION_KEY = "nexo.stats.session.v1";
export const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type Consent = { visitor_id: string; expires: number; policy_version: "2026-10-20" };
export interface Store { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function clearStats(local: Store, session: Store) {
  try { local.removeItem(CONSENT_KEY); } finally { session.removeItem(SESSION_KEY); }
}
export function readConsent(local: Store, now = Date.now()): Consent | null {
  try {
    const value: unknown = JSON.parse(local.getItem(CONSENT_KEY) || "null");
    if (value && typeof value === "object" && "visitor_id" in value && "expires" in value && "policy_version" in value && typeof value.visitor_id === "string" && UUID.test(value.visitor_id) && typeof value.expires === "number" && value.expires > now && value.expires <= now + MAX_AGE && value.policy_version === "2026-10-20") return value as Consent;
    local.removeItem(CONSENT_KEY);
  } catch { /* Storage may be blocked. No fallback identifier. */ }
  return null;
}
export function grantConsent(local: Store, session: Store, uuid: () => string, now = Date.now()): Consent {
  const consent: Consent = { visitor_id: uuid(), expires: now + MAX_AGE, policy_version: "2026-10-20" };
  try { local.setItem(CONSENT_KEY, JSON.stringify(consent)); session.setItem(SESSION_KEY, uuid()); }
  catch (error) { clearStats(local, session); throw error; }
  return consent;
}
export function sessionId(session: Store, uuid: () => string): string {
  const old = session.getItem(SESSION_KEY);
  if (old && UUID.test(old)) return old;
  const value = uuid(); session.setItem(SESSION_KEY, value); return value;
}
export function doorForPath(path: string): Door | null {
  if (path.replace(/\/$/, "") === "/decouvrir") return "discover";
  if (path.replace(/\/$/, "") === "/experience") return "experience";
  return null;
}
// Observes committed destinations, not clicks. Back and cross-door returns count again;
// locale/consent rerenders and same-page anchors do not create duplicate entries.
export function enteredDoor(previous: string | null, current: string): Door | null {
  return previous === current ? null : doorForPath(current);
}
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
export async function withStatsLock<T>(operation: () => Promise<T>): Promise<T> {
  // Coordinate same-origin tabs where Web Locks are supported. No storage added.
  if (typeof navigator !== "undefined" && navigator.locks) {
    return await navigator.locks.request("nexo.stats.delivery", operation);
  }
  return await operation();
}
export function eventPayload(consent: Consent, session: string, door: Door, locale: "fr" | "en") {
  return { visitor_id: consent.visitor_id, session_id: session, event: "door_enter" as const, door, locale, consent: true as const, policy_version: consent.policy_version };
}
