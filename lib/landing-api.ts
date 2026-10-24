import { z } from "zod";

export type Locale = "fr" | "en";
export const POLICY_VERSION = "2026-10-20" as const;
export const API_BASE = (process.env.NEXT_PUBLIC_NEXO_API_URL?.trim() || "http://127.0.0.1:8787").replace(/\/+$/, "");
export class ApiError extends Error {
  status: number;
  constructor(status: number) { super("Request failed"); this.status = status; }
}
export async function apiRequest(path: string, init: RequestInit = {}, expected: number | readonly number[] = 200): Promise<Response> {
  const response = await fetch(`${API_BASE}/api/v1/landing/${path}`, {
    ...init, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
    signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  if (typeof expected === "number" ? response.status !== expected : !expected.includes(response.status)) throw new ApiError(response.status);
  return response;
}
export function postJson(path: string, body: unknown, expected: number | readonly number[] = 201, signal?: AbortSignal) {
  return apiRequest(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }, expected);
}
export const configSchema = z.object({
  video_url: z.string().nullable(), privacy_contact: z.string().nullable(), controller_name: z.string().nullable(),
  policy_version: z.literal(POLICY_VERSION), demo_enabled: z.boolean(), realtime_enabled: z.boolean().default(false),
});
export type LandingConfig = z.infer<typeof configSchema>;
export const defaultConfig: LandingConfig = { video_url: null, privacy_contact: "ikeecode@gmail.com", controller_name: "Mahamadou KABA", policy_version: POLICY_VERSION, demo_enabled: false, realtime_enabled: false };
export function errorMessage(error: unknown, locale: Locale): string {
  if (error instanceof ApiError && error.status === 429) return locale === "fr" ? "Trop de demandes. Réessaie dans quelques instants." : "Too many requests. Please try again shortly.";
  return locale === "fr" ? "Le service est indisponible ou la connexion a été interrompue. Rien n’est confirmé. Tu peux réessayer." : "The service is unavailable or the connection was interrupted. Nothing is confirmed. You can try again.";
}
export type SafeVideo = { kind: "file" | "youtube" | "vimeo"; url: string; origin: string };
export function introductionVideo(raw: string | null, locale: Locale): SafeVideo {
  return safeVideo(raw) ?? { kind: "file", url: `/media/video/nexo-video-${locale}.mp4`, origin: "" };
}
export function safeVideo(raw: string | null): SafeVideo | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
    if (/\.(mp4|webm|ogv)$/i.test(url.pathname)) return { kind: "file", url: url.href, origin: url.origin };
    if (["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtu.be"].includes(url.hostname)) {
      const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.pathname.startsWith("/embed/") ? url.pathname.slice(7) : url.searchParams.get("v");
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return { kind: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=0`, origin: "https://www.youtube-nocookie.com" };
    }
    if (["vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
      const id = url.pathname.replace(/^\/(video\/)?/, "");
      if (!/^\d+$/.test(id)) return null;
      return { kind: "vimeo", url: `https://player.vimeo.com/video/${id}?autoplay=0&dnt=1`, origin: "https://player.vimeo.com" };
    }
  } catch { /* Invalid configuration never becomes an embed. */ }
  return null;
}
