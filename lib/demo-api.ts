export const CHAT_VISITOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DemoLocale = "fr" | "en";
export type DemoMessage = { role: "user" | "assistant"; content: string };
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_ASSISTANT_LENGTH = 6000;
export const MAX_CHAT_REPLIES = 15;
export const MAX_CHAT_MESSAGES = MAX_CHAT_REPLIES * 2 - 1;
export const MAX_CHAT_CHARACTERS = 120_000;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 30;
const MAX_RESPONSE_BYTES = 64 * 1024;
const ERROR_SENTINEL = "\n\0ERROR";

export class DemoApiError extends Error {
  readonly code: "unavailable" | "network" | "timeout" | "response" | "limit" | "consent" | "rate_limited" | "exhausted" | "busy" | "visitor";
  constructor(code: DemoApiError["code"]) {
    super(code);
    this.name = "DemoApiError";
    this.code = code;
  }
}

function endpoint(path: string) {
  const base = process.env.NEXT_PUBLIC_NEXO_API_URL?.trim() || "http://127.0.0.1:8787";
  return `${base.replace(/\/+$/, "")}/api/v1/landing/demo/${path}`;
}

async function request<T>(
  path: string,
  init: RequestInit,
  signal: AbortSignal,
  consume: (response: Response) => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 45_000);
  try {
    const response = await fetch(endpoint(path), {
      ...init, method: init.method ?? "POST", signal: controller.signal, credentials: "omit", cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) {
      let detail: unknown;
      try {
        if (response.body) detail = JSON.parse(await readDemoStream(response.body, () => {}));
      } catch { /* Never display server error details. */ }
      const code = detail && typeof detail === "object" && "error" in detail ? detail.error : null;
      throw new DemoApiError(response.status === 429 ? code === "chat_exhausted" ? "exhausted" : "rate_limited" : response.status === 409 && code === "chat_busy" ? "busy" : response.status === 413 ? "limit" : response.status === 503 ? "unavailable" : "response");
    }
    return await consume(response);
  } catch (error) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (timedOut) throw new DemoApiError("timeout");
    if (error instanceof DemoApiError) throw error;
    throw new DemoApiError("network");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    controller.abort();
  }
}

/** Withhold any trailing sentinel prefix, including across UTF-8/network boundaries. */
export async function readDemoStream(
  body: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      bytes += value?.byteLength ?? 0;
      if (bytes > MAX_RESPONSE_BYTES) throw new DemoApiError("limit");
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (pending.includes(ERROR_SENTINEL)) throw new DemoApiError("response");
      let held = 0;
      for (let length = 1; length < ERROR_SENTINEL.length; length++) {
        if (pending.endsWith(ERROR_SENTINEL.slice(0, length))) held = length;
      }
      const visible = pending.slice(0, pending.length - held);
      // A NUL or truncated error marker is never user-facing text.
      if (visible.includes("\0")) throw new DemoApiError("response");
      text += visible;
      pending = pending.slice(pending.length - held);
      if (visible) onText(text);
      if (done) {
        if (pending.includes("\0")) throw new DemoApiError("response");
        text += pending;
        if (!text.trim()) throw new DemoApiError("response");
        if (pending) onText(text);
        return text;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export type DemoChatReply = { text: string; remaining: number };

function validRemaining(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_CHAT_REPLIES;
}

export async function getDemoChatQuota({ visitorId, signal }: { visitorId: string; signal: AbortSignal }): Promise<number> {
  if (!CHAT_VISITOR_UUID.test(visitorId)) throw new DemoApiError("visitor");
  return request("chat/quota", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ visitor_id: visitorId }),
  }, signal, async response => {
    if (!response.body) throw new DemoApiError("response");
    let data: unknown;
    try { data = JSON.parse(await readDemoStream(response.body, () => {})); }
    catch (error) { if (error instanceof DemoApiError) throw error; throw new DemoApiError("response"); }
    if (!data || typeof data !== "object" || !("remaining" in data) || !validRemaining(data.remaining)) throw new DemoApiError("response");
    return data.remaining;
  });
}

export async function sendDemoChat({ locale, visitorId, messages, consent, signal, onText }: {
  locale: DemoLocale; visitorId: string; messages: DemoMessage[]; consent: boolean;
  signal: AbortSignal; onText: (text: string) => void;
}): Promise<DemoChatReply> {
  if (!consent) throw new DemoApiError("consent");
  if (!CHAT_VISITOR_UUID.test(visitorId)) throw new DemoApiError("visitor");
  if (!messages.length || messages.length > MAX_CHAT_MESSAGES || messages.at(-1)?.role !== "user" || messages.some((message, index) =>
    message.role !== (index % 2 === 0 ? "user" : "assistant") ||
    !message.content.trim() || message.content.length > (message.role === "assistant" ? MAX_ASSISTANT_LENGTH : MAX_MESSAGE_LENGTH)
  ) || messages.reduce((total, message) => total + message.content.length, 0) > MAX_CHAT_CHARACTERS) throw new DemoApiError("limit");
  return request("chat", {
    headers: { "Content-Type": "application/json", Accept: "text/plain, application/json" },
    body: JSON.stringify({ locale, visitor_id: visitorId, messages, consent: true }),
  }, signal, async (response) => {
    if (!response.body) throw new DemoApiError("response");
    const header = response.headers.get("X-Nexo-Chat-Remaining");
    if (header === null || !/^(?:[0-9]|1[0-5])$/.test(header)) {
      await response.body.cancel();
      throw new DemoApiError("response");
    }
    const text = await readDemoStream(response.body, onText);
    return { text, remaining: Number(header) };
  });
}

export async function transcribeDemoAudio({ locale, file, consent, signal }: {
  locale: DemoLocale; file: Blob; consent: boolean; signal: AbortSignal;
}): Promise<string> {
  if (!consent) throw new DemoApiError("consent");
  if (!file.size || file.size > MAX_AUDIO_BYTES) throw new DemoApiError("limit");
  const form = new FormData();
  const extension = file.type.includes("mp4") ? "m4a" : file.type.includes("ogg") ? "ogg" : "webm";
  form.append("file", file, `recording.${extension}`);
  form.append("language", locale);
  form.append("consent", "true");
  return request("transcribe", { body: form }, signal, async (response) => {
    if (!response.body) throw new DemoApiError("response");
    let value: unknown;
    try { value = JSON.parse(await readDemoStream(response.body, () => {})); }
    catch (error) {
      if (error instanceof DemoApiError) throw error;
      throw new DemoApiError("response");
    }
    if (!value || typeof value !== "object" || !("text" in value) || typeof value.text !== "string" || !value.text.trim()) {
      throw new DemoApiError("response");
    }
    if (value.text.length > MAX_MESSAGE_LENGTH) throw new DemoApiError("limit");
    return value.text.trim();
  });
}
