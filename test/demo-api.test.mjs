import assert from "node:assert/strict";
import test from "node:test";
import { DemoApiError, MAX_AUDIO_BYTES, MAX_CHAT_REPLIES, MAX_CHAT_MESSAGES, MAX_CHAT_CHARACTERS, readDemoStream, sendDemoChat, transcribeDemoAudio } from "../lib/demo-api.ts";

const visitorId = "12345678-1234-4234-8234-123456789abc";
function chatResponse(body, init = {}) {
  return new Response(body, { ...init, headers: { "X-Nexo-Chat-Remaining": "14", ...init.headers } });
}
const encoder = new TextEncoder();
const marker = "\n\0ERROR";
function stream(parts) {
  return new ReadableStream({ start(controller) {
    for (const part of parts) controller.enqueue(typeof part === "string" ? encoder.encode(part) : part);
    controller.close();
  } });
}
const options = () => ({ locale: "fr", visitorId, consent: true, messages: [{ role: "user", content: "Bonjour" }], signal: new AbortController().signal, onText() {} });

for (let split = 0; split <= marker.length; split++) {
  test(`rejects error sentinel split at ${split} without displaying it`, async () => {
    const seen = [];
    await assert.rejects(readDemoStream(stream(["Début", marker.slice(0, split), marker.slice(split), "private error details"]), (text) => seen.push(text)), { code: "response" });
    assert.ok(seen.every((text) => text === "Début"));
  });
}
test("handles byte-by-byte UTF-8 and normal newlines", async () => {
  const text = "Respire 🌿\nÀ ton rythme.\n";
  const bytes = [...encoder.encode(text)].map((byte) => Uint8Array.of(byte));
  let visible = "";
  assert.equal(await readDemoStream(stream(bytes), (part) => { visible = part; }), text);
  assert.equal(visible, text);
});
test("rejects a marker sent one byte at a time", async () => {
  const seen = [];
  await assert.rejects(readDemoStream(stream([...encoder.encode(`Hello${marker}`)].map((byte) => Uint8Array.of(byte))), (text) => seen.push(text)), { code: "response" });
  assert.ok(seen.every((text) => !text.includes("\0") && !text.includes("ERROR")));
});
test("rejects empty, truncated sentinel and oversized responses", async () => {
  for (const text of ["", "  ", "Hello\n\0ERR"]) {
    await assert.rejects(readDemoStream(stream([text]), () => {}), { code: "response" });
  }
  await assert.rejects(readDemoStream(stream(["x".repeat(65537)]), () => {}), { code: "limit" });
});
test("cancels the reader after a sentinel failure", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(marker)); }, cancel() { cancelled = true; } });
  await assert.rejects(readDemoStream(body, () => {}), DemoApiError);
  assert.equal(cancelled, true);
});
test("chat posts the exact consented payload directly to Django", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const base = process.env.NEXT_PUBLIC_NEXO_API_URL?.trim().replace(/\/+$/, "") || "http://127.0.0.1:8787";
    assert.equal(url, `${base}/api/v1/landing/demo/chat`);
    assert.equal(init.method, "POST");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers.Accept, "text/plain, application/json", "DRF must be able to negotiate JSON errors as well as streamed text");
    assert.deepEqual(JSON.parse(init.body), { locale: "fr", visitor_id: visitorId, messages: [{ role: "user", content: "Bonjour" }], consent: true });
    return chatResponse(stream(["Bon", "jour"]));
  });
  assert.deepEqual(await sendDemoChat(options()), { text: "Bonjour", remaining: 14 });
});
test("Django conversation constraints reject invalid history before fetch", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("must not fetch"); });
  const histories = [
    [{ role: "assistant", content: "Hello" }],
    [{ role: "user", content: "Hello" }, { role: "user", content: "Again" }],
    [{ role: "user", content: "Hello" }, { role: "assistant", content: "Reply" }],
    [{ role: "user", content: "Hello" }, { role: "assistant", content: "x".repeat(6001) }, { role: "user", content: "Again" }],
    Array.from({ length: 31 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "Hi" })),
    Array.from({ length: 29 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "x".repeat(6001) })),
  ];
  for (const messages of histories) await assert.rejects(sendDemoChat({ ...options(), messages }), { code: "limit" });
  assert.equal(fetch.mock.callCount(), 0);
});

test("15th request accepts all 29 maximally-sized messages, while a 16th request is rejected", async (t) => {
  assert.equal(MAX_CHAT_REPLIES, 15);
  assert.equal(MAX_CHAT_MESSAGES, 29);
  assert.equal(MAX_CHAT_CHARACTERS, 120000);
  const fetch = t.mock.method(globalThis, "fetch", async () => chatResponse("Reply"));
  const messages = Array.from({ length: 29 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "x".repeat(index % 2 ? 6000 : 2000) }));
  assert.equal(messages.reduce((sum, message) => sum + message.content.length, 0), 114000);
  assert.deepEqual(await sendDemoChat({ ...options(), messages }), { text: "Reply", remaining: 14 });
  assert.equal(fetch.mock.callCount(), 1);
  messages.push({ role: "assistant", content: "Reply" }, { role: "user", content: "Sixteenth" });
  await assert.rejects(sendDemoChat({ ...options(), messages }), { code: "limit" });
  assert.equal(fetch.mock.callCount(), 1);
});

for (const [status, code] of [[429, "rate_limited"], [413, "limit"], [503, "unavailable"]]) {
  test(`HTTP ${status} maps to ${code}`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => chatResponse("not public error details", { status }));
    await assert.rejects(sendDemoChat(options()), { code });
  });
}

test("consent and limits reject before any request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not run"); });
  await assert.rejects(sendDemoChat({ ...options(), consent: false }), { code: "consent" });
  await assert.rejects(sendDemoChat({ ...options(), messages: [{ role: "user", content: "x".repeat(2001) }] }), { code: "limit" });
  await assert.rejects(sendDemoChat({ ...options(), messages: Array.from({ length: 21 }, () => ({ role: "user", content: "Hi" })) }), { code: "limit" });
  const audio = { locale: "en", consent: true, signal: new AbortController().signal, file: new Blob(["audio"], { type: "audio/webm" }) };
  await assert.rejects(transcribeDemoAudio({ ...audio, consent: false }), { code: "consent" });
  await assert.rejects(transcribeDemoAudio({ ...audio, file: new Blob([]) }), { code: "limit" });
  await assert.rejects(transcribeDemoAudio({ ...audio, file: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]) }), { code: "limit" });
  assert.equal(fetch.mock.callCount(), 0);
});
test("transcription sends multipart audio, language and consent; returns editable text", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(url.endsWith("/api/v1/landing/demo/transcribe"));
    assert.ok(init.body instanceof FormData);
    assert.equal(init.body.get("language"), "en");
    assert.equal(init.body.get("consent"), "true");
    assert.equal(init.body.get("file").name, "recording.m4a");
    assert.equal(await init.body.get("file").text(), "audio");
    return Response.json({ text: "  A quiet moment.  " });
  });
  assert.equal(await transcribeDemoAudio({ locale: "en", consent: true, signal: new AbortController().signal, file: new Blob(["audio"], { type: "audio/mp4" }) }), "A quiet moment.");
});
test("malformed transcription does not create a fake transcript", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ text: 42 }));
  const audio = { locale: "fr", consent: true, signal: new AbortController().signal, file: new Blob(["audio"]) };
  await assert.rejects(transcribeDemoAudio(audio), { code: "response" });
  fetch.mock.mockImplementation(async () => Response.json({ text: "x".repeat(2001) }));
  await assert.rejects(transcribeDemoAudio(audio), { code: "limit" });
});
test("503, other HTTP errors and network failures are honest errors", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => chatResponse("unavailable", { status: 503 }));
  await assert.rejects(sendDemoChat(options()), { code: "unavailable" });
  fetch.mock.mockImplementation(async () => chatResponse("failed", { status: 500 }));
  await assert.rejects(sendDemoChat(options()), { code: "response" });
  fetch.mock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(sendDemoChat(options()), { code: "network" });
});
test("caller cancellation aborts an in-flight request", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
  }));
  const result = sendDemoChat({ ...options(), signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
});
test("pre-aborted request does not fetch", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => chatResponse("unused"));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(sendDemoChat({ ...options(), signal: controller.signal }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 0);
});
test("a stream failure is reported rather than returning a partial reply", async (t) => {
  let reads = 0;
  t.mock.method(globalThis, "fetch", async () => chatResponse(new ReadableStream({ pull(controller) {
    if (reads++ === 0) controller.enqueue(encoder.encode("Partial reply"));
    else controller.error(new TypeError("connection lost"));
  } })));
  await assert.rejects(sendDemoChat(options()), { code: "network" });
});
test("timeout remains active while the response body is streaming", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let began;
  const streaming = new Promise((resolve) => { began = resolve; });
  t.mock.method(globalThis, "fetch", async (_url, init) => chatResponse(new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode("Partial"));
    init.signal.addEventListener("abort", () => controller.error(new DOMException("Cancelled", "AbortError")), { once: true });
  } })));
  const result = sendDemoChat({ ...options(), onText: began });
  await streaming;
  t.mock.timers.tick(45_000);
  await assert.rejects(result, { code: "timeout" });
});
test("request timeout aborts a stalled request", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  t.mock.method(globalThis, "fetch", (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => { aborted = true; reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
  }));
  const result = sendDemoChat(options());
  t.mock.timers.tick(45_000);
  await assert.rejects(result, { code: "timeout" });
  assert.equal(aborted, true);
});
