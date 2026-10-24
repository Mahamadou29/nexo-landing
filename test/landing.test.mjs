import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_KEY, SESSION_KEY, MAX_AGE, readConsent, grantConsent, clearStats, sessionId, enteredDoor, doorForPath, eventPayload, createSerialQueue } from "../lib/analytics.ts";
import { classifyMood, moodWords } from "../lib/mood.ts";
import { apiRequest, postJson, ApiError, safeVideo, introductionVideo, configSchema, defaultConfig } from "../lib/landing-api.ts";
import { readFileSync } from "node:fs";
const uuid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
function store() { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; }
test("untracked default does not create identifiers or records", () => {
  const local = store(); assert.equal(readConsent(local, 1000), null); assert.equal(local.values.size, 0);
});
test("consent creates bounded visitor and session only after grant", () => {
  const local = store(), session = store(); let calls = 0;
  const consent = grantConsent(local, session, () => (++calls === 1 ? uuid : other), 1000);
  assert.equal(calls, 2); assert.equal(consent.expires, 1000 + MAX_AGE);
  assert.deepEqual(readConsent(local, 1001), consent); assert.equal(sessionId(session, () => { throw Error("must reuse"); }), other);
  assert.equal(readConsent(local, 1000 + MAX_AGE), null); assert.equal(local.getItem(CONSENT_KEY), null);
});
test("invalid and overlong permissions do not enable tracking", () => {
  for (const value of [{ visitor_id: uuid, expires: MAX_AGE + 1002, policy_version: "2026-10-20" }, { visitor_id: "bad", expires: 2000, policy_version: "2026-10-20" }, { visitor_id: uuid, expires: 2000, policy_version: "old" }]) {
    const local = store(); local.setItem(CONSENT_KEY, JSON.stringify(value)); assert.equal(readConsent(local, 1000), null);
  }
});
test("withdrawal clears both identifiers without touching unrelated storage", () => {
  const local = store(), session = store(); grantConsent(local, session, () => uuid); local.setItem("other", "kept");
  clearStats(local, session); assert.equal(local.getItem(CONSENT_KEY), null); assert.equal(session.getItem(SESSION_KEY), null); assert.equal(local.getItem("other"), "kept");
});
test("blocked session storage rolls back visitor consent", () => {
  const local = store(), session = store(); session.setItem = () => { throw new Error("blocked"); };
  assert.throws(() => grantConsent(local, session, () => uuid)); assert.equal(local.getItem(CONSENT_KEY), null);
});
test("door events represent committed entries including back, not rerenders", () => {
  let previous = null; const entries = [];
  for (const path of ["/", "/decouvrir", "/decouvrir", "/experience", "/decouvrir", "/confidentialite", "/decouvrir", "/"]) {
    const door = enteredDoor(previous, path); if (door) entries.push(door); previous = path;
  }
  assert.deepEqual(entries, ["discover", "experience", "discover", "discover"]);
  assert.equal(doorForPath("/experience/"), "experience"); assert.equal(doorForPath("/unknown"), null);
});
test("withdrawal is serialized after an in-flight event response", async () => {
  const queue = createSerialQueue(); const order = []; let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const event = queue.run(async () => { order.push("event-start"); await response; order.push("event-finish"); });
  const withdrawal = queue.run(async () => { order.push("withdraw"); });
  await Promise.resolve(); assert.deepEqual(order, ["event-start"]);
  finish(); await Promise.all([event, withdrawal]); assert.deepEqual(order, ["event-start", "event-finish", "withdraw"]);
});
test("failed event does not block subsequent withdrawal or cause a retry", async () => {
  const queue = createSerialQueue(); let calls = 0;
  await assert.rejects(queue.run(async () => { calls++; throw new Error("unavailable"); }));
  assert.equal(await queue.run(async () => "withdrawn"), "withdrawn"); assert.equal(calls, 1);
});
test("metrics payload is an allowlist with no content/contact/mood", () => {
  const body = eventPayload({ visitor_id: uuid, expires: 1, policy_version: "2026-10-20", mood: "private" }, other, "discover", "en");
  assert.deepEqual(Object.keys(body).sort(), ["visitor_id", "session_id", "event", "door", "locale", "consent", "policy_version"].sort());
});
for (const phrase of ["je ne suis pas heureux", "not happy", "I’m not sad", "pas triste", "je suis bien mais triste", "I feel good and tired", "I don't feel good", "nothing in particular", "", "je n’ai plus envie", "sans stress", "I can't feel happy"]) {
  test(`mood stays neutral for unclear/negated input: ${phrase}`, () => assert.equal(classifyMood(phrase), "neutral"));
}
test("local keywords select gentle or bright wording without diagnosis", () => {
  assert.equal(classifyMood("fatiguée"), "gentle"); assert.equal(classifyMood("calm"), "bright");
  assert.equal(moodWords.fr.neutral.length, moodWords.en.neutral.length);
});
test("video accepts only safe media and known iframe providers", () => {
  assert.equal(safeVideo("javascript:alert(1)"), null); assert.equal(safeVideo("https://evil.example/embed/123"), null);
  assert.equal(safeVideo("https://youtube.com.evil.example/embed/abcdefghijk"), null);
  assert.equal(safeVideo("https://user:pass@example.com/a.mp4"), null);
  assert.equal(safeVideo("http://example.com/a.mp4"), null);
  assert.equal(safeVideo("https://cdn.example.com/a.mp4")?.kind, "file");
  assert.equal(safeVideo("https://youtu.be/abcdefghijk")?.origin, "https://www.youtube-nocookie.com");
  assert.equal(safeVideo("https://vimeo.com/12345")?.kind, "vimeo");
});
test("supplied introduction videos follow the locale without requiring backend availability", () => {
  for (const locale of ["fr", "en"]) {
    const video = introductionVideo(null, locale);
    assert.deepEqual(video, { kind: "file", url: `/media/video/nexo-video-${locale}.mp4`, origin: "" });
    assert.deepEqual(introductionVideo("javascript:alert(1)", locale), video);
    const bytes = readFileSync(new URL(`../public${video.url}`, import.meta.url));
    assert.equal(bytes.toString("ascii", 4, 8), "ftyp");
    assert.ok(bytes.length > 1000);
  }
  assert.deepEqual(introductionVideo("https://cdn.example.com/custom.mp4", "fr"), safeVideo("https://cdn.example.com/custom.mp4"));
  assert.equal(introductionVideo("https://youtu.be/abcdefghijk", "en").kind, "youtube");
});

test("confirmed public controller and contact remain available without the backend", () => {
  assert.equal(defaultConfig.controller_name, "Mahamadou KABA");
  assert.equal(defaultConfig.privacy_contact, "ikeecode@gmail.com");
});
test("realtime flag defaults off independently of legacy chat", () => {
  const { realtime_enabled, ...older } = defaultConfig;
  assert.equal(realtime_enabled, false);
  assert.equal(configSchema.parse({ ...older, demo_enabled: true }).realtime_enabled, false);
  assert.equal(configSchema.parse({ ...older, realtime_enabled: true }).demo_enabled, false);
  assert.equal(configSchema.safeParse({ ...older, realtime_enabled: "true" }).success, false);
});
test("config rejects unsupported policy version", () => {
  assert.ok(configSchema.safeParse(defaultConfig).success); assert.equal(configSchema.safeParse({ ...defaultConfig, policy_version: "old" }).success, false);
});
test("waitlist transport requires exactly 201 and uses no credentials", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => { assert.ok(String(url).endsWith("/api/v1/landing/waitlist")); assert.equal(options.credentials, "omit"); assert.equal(options.referrerPolicy, "no-referrer"); assert.ok(options.signal); return new Response("{}", { status: 200 }); };
    await assert.rejects(postJson("waitlist", {}), error => error instanceof ApiError && error.status === 200);
    globalThis.fetch = async () => new Response('{"status":"registered"}', { status: 201 });
    assert.equal((await postJson("waitlist", {})).status, 201);
  } finally { globalThis.fetch = original; }
});
test("API handles unavailable service, aborted requests and allowed withdrawal statuses", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(apiRequest("config"), error => error instanceof ApiError && error.status === 503);
    globalThis.fetch = async (_, options) => { options.signal.throwIfAborted(); return new Response(null, { status: 204 }); };
    const controller = new AbortController(); controller.abort(); await assert.rejects(apiRequest("config", { signal: controller.signal }));
    assert.equal((await postJson("events/withdraw", {}, [200, 204])).status, 204);
  } finally { globalThis.fetch = original; }
});
