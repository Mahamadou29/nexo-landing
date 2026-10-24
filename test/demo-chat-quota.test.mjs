import assert from "node:assert/strict";
import test from "node:test";
import { DemoApiError, getDemoChatQuota, sendDemoChat } from "../lib/demo-api.ts";
import { chat, deferredSend, flush, VISITOR_ID } from "./demo-chat-harness.mjs";

const options = () => ({ visitorId: VISITOR_ID, signal: new AbortController().signal });
const post = () => ({ ...options(), locale: "fr", consent: true, messages: [{ role: "user", content: "Hello" }], onText() {} });

test("quota POST keeps the UUID out of the URL and sends no conversation content", async t => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(url.endsWith("/api/v1/landing/demo/chat/quota"));
    assert.equal(new URL(url).search, "");
    assert.ok(!url.includes(VISITOR_ID));
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers.Accept, "application/json");
    assert.deepEqual(JSON.parse(init.body), { visitor_id: VISITOR_ID });
    assert.equal(init.cache, "no-store");
    assert.equal(init.credentials, "omit");
    assert.equal(init.referrerPolicy, "no-referrer");
    return Response.json({ remaining: 7 });
  });
  assert.equal(await getDemoChatQuota(options()), 7);
});

test("missing/invalid visitor IDs reject quota and chat POSTs before fetch", async t => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw Error("must not fetch"); });
  for (const visitorId of [undefined, "", "not-a-uuid", "12345678-1234-1234-1234-123456789abc"]) {
    await assert.rejects(getDemoChatQuota({ ...options(), visitorId }), { code: "visitor" });
    await assert.rejects(sendDemoChat({ ...post(), visitorId }), { code: "visitor" });
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("quota counts must be integers in 0..15, never coerced or defaulted", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}));
  for (const remaining of [undefined, null, -1, 16, 1.5, "15", false]) {
    fetch.mock.mockImplementation(async () => Response.json({ remaining }));
    await assert.rejects(getDemoChatQuota(options()), { code: "response" });
  }
  fetch.mock.mockImplementation(async () => new Response("not JSON"));
  await assert.rejects(getDemoChatQuota(options()), { code: "response" });
  for (const remaining of [0, 15]) {
    fetch.mock.mockImplementation(async () => Response.json({ remaining }));
    assert.equal(await getDemoChatQuota(options()), remaining);
  }
});

test("quota-specific 429, generic rate limiting and visitor-busy 409 stay distinct", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response());
  for (const [status, error, code] of [[429, "chat_exhausted", "exhausted"], [429, "rate_limited", "rate_limited"], [409, "chat_busy", "busy"], [409, "other", "response"]]) {
    fetch.mock.mockImplementation(async () => Response.json({ error }, { status }));
    await assert.rejects(sendDemoChat(post()), { code });
  }
});

test("successful stream returns the exposed authoritative header, not an assumed local decrement", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("Complete", { headers: { "X-Nexo-Chat-Remaining": "3" } }));
  assert.deepEqual(await sendDemoChat(post()), { text: "Complete", remaining: 3 });
});

test("missing, inaccessible or malformed remaining header cannot grant quota", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response());
  for (const header of [null, "", "-1", "16", "3.5", "15x"]) {
    fetch.mock.mockImplementation(async () => new Response("Complete", { headers: header === null ? {} : { "X-Nexo-Chat-Remaining": header } }));
    await assert.rejects(sendDemoChat(post()), { code: "response" });
  }
});

test("projected header is applied only after full success; quota lookup ignores a pending reservation", async t => {
  let completed = 0;
  let streamController;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/chat/quota")) return Response.json({ remaining: 15 - completed });
    return new Response(new ReadableStream({ start(controller) {
      streamController = controller;
      controller.enqueue(new TextEncoder().encode("Partial"));
    } }), { headers: { "X-Nexo-Chat-Remaining": "14" } });
  });
  let state;
  const h = new chat.DemoChatSession("en", next => { state = next; }, {
    send: sendDemoChat, getQuota: getDemoChatQuota, getVisitor: () => VISITOR_ID,
  });
  await h.refreshQuota();
  const result = h.submit("Hello", true);
  await flush();
  assert.equal(state.partial, "Partial");
  assert.equal(state.remaining, 15, "headers and partial text cannot spend a reply locally");
  assert.equal(await getDemoChatQuota(options()), 15);
  assert.equal(state.messages.length, 0);
  completed = 1;
  streamController.close();
  assert.equal(await result, true);
  assert.equal(state.remaining, 14);
  assert.equal(state.messages.length, 2);
  assert.equal(await getDemoChatQuota(options()), 14);
  h.dispose();
});

test("a failed stream never commits its reservation header", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("Partial\n\0ERROR", { headers: { "X-Nexo-Chat-Remaining": "0" } }));
  await assert.rejects(sendDemoChat(post()), { code: "response" });
});

function session(transport, getQuota = transport.getQuota, getVisitor = () => VISITOR_ID) {
  let state = chat.emptyChat();
  const value = new chat.DemoChatSession("en", next => { state = next; }, { send: transport.send, getQuota, getVisitor });
  return { value, state: () => state };
}

test("initialization and failed quota fetch disable sends without granting 15", async () => {
  const transport = deferredSend();
  const h = session(transport);
  assert.equal(h.state().remaining, null);
  assert.equal(await h.value.submit("Hello", true), false);
  transport.backend.quotaError = new DemoApiError("network");
  await h.value.refreshQuota();
  assert.equal(h.state().quotaStatus, "error");
  assert.equal(h.state().remaining, null);
  assert.equal(await h.value.submit("Hello", true), false);
  assert.equal(transport.calls.length, 0);
  transport.backend.quotaError = null;
  transport.backend.remaining = 2;
  await h.value.refreshQuota();
  assert.equal(h.state().remaining, 2);
});

test("storage failures never fall back to a newly granted in-memory identity", async () => {
  const transport = deferredSend();
  const h = session(transport, transport.getQuota, () => { throw Error("storage denied"); });
  await h.value.refreshQuota();
  assert.equal(h.state().quotaError, "storage");
  assert.equal(await h.value.submit("Hello", true), false);
  assert.equal(transport.quotaCalls.length, 0);
});

test("remaining is shared across empty histories, clear and reloaded sessions", async () => {
  const transport = deferredSend(1);
  const h = session(transport);
  await h.value.refreshQuota();
  const sent = h.value.submit("Last reply", true);
  transport.calls[0].resolve("Complete"); await sent;
  assert.equal(h.state().remaining, 0);
  h.value.clear();
  assert.equal(h.state().messages.length, 0);
  assert.equal(h.state().remaining, 0);
  assert.equal(await h.value.submit("Not renewed", true), false);
  h.value.dispose();
  const reload = session(transport);
  assert.equal(reload.state().remaining, null);
  await reload.value.refreshQuota();
  assert.equal(reload.state().remaining, 0);
  assert.equal(await reload.value.submit("Still exhausted", true), false);
  assert.equal(transport.calls.length, 1);
});

test("header and quota refresh are authoritative even when different from local history", async () => {
  const transport = deferredSend(10);
  const h = session(transport);
  await h.value.refreshQuota();
  let sent = h.value.submit("Hello", true);
  transport.calls[0].resolve({ text: "Complete", remaining: 4 }); await sent;
  assert.equal(h.state().remaining, 4);
  sent = h.value.submit("Again", true);
  transport.backend.remaining = 3; // A separate successful request in another tab.
  transport.calls[1].reject(new DemoApiError("network")); await sent;
  assert.equal(h.state().quotaStatus, "loading");
  assert.equal(await h.value.submit("Wait for quota", true), false);
  await flush();
  assert.equal(h.state().remaining, 3);
  assert.equal(h.state().messages.length, 2);
});

test("late quota responses and unmounted quota owners cannot overwrite newer results", async () => {
  const transport = deferredSend();
  const requests = [];
  const h = session(transport, options => new Promise(resolve => requests.push({ ...options, resolve })));
  const first = h.value.refreshQuota();
  const second = h.value.refreshQuota();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(2); await second;
  requests[0].resolve(15); await first;
  assert.equal(h.state().remaining, 2);
  const third = h.value.refreshQuota();
  const snapshot = h.state();
  h.value.dispose();
  assert.equal(requests[2].signal.aborted, true);
  requests[2].resolve(15); await third;
  assert.equal(h.state(), snapshot);
});

test("cross-tab refresh during an active request is deferred, not lost", async () => {
  const transport = deferredSend(15);
  const h = session(transport, async () => 5);
  await h.value.refreshQuota();
  const sent = h.value.submit("Hello", true);
  await h.value.refreshQuota();
  transport.calls[0].resolve({ text: "Complete", remaining: 4 }); await sent;
  await flush();
  assert.equal(h.state().remaining, 5, "fresh quota lookup wins over an older reservation header");
});

test("storage changes after initialization fail closed before any POST", async () => {
  const transport = deferredSend();
  let id = VISITOR_ID;
  const h = session(transport, transport.getQuota, () => id);
  await h.value.refreshQuota();
  id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  assert.equal(await h.value.submit("Do not switch identities", true), false);
  assert.equal(h.state().quotaError, "storage");
  assert.equal(transport.calls.length, 0);
});

test("blocked cross-tab notifications cannot turn a successful reply into failure", async () => {
  const transport = deferredSend();
  let state;
  const h = new chat.DemoChatSession("en", next => { state = next; }, {
    send: transport.send, getQuota: transport.getQuota, getVisitor: () => VISITOR_ID,
    onSettled() { throw Error("BroadcastChannel unavailable"); },
  });
  await h.refreshQuota();
  const sent = h.submit("Hello", true);
  transport.calls[0].resolve("Complete");
  assert.equal(await sent, true);
  assert.equal(state.messages.length, 2);
  assert.equal(state.status, "sent");
  assert.equal(state.remaining, 14);
});
