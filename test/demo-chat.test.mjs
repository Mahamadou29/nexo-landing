import assert from "node:assert/strict";
import test from "node:test";
import { DemoApiError } from "../lib/demo-api.ts";
import { chat, deferredSend, plain, flush, VISITOR_ID } from "./demo-chat-harness.mjs";

async function session(locale = "fr") {
  const transport = deferredSend();
  const states = [];
  const value = new chat.DemoChatSession(locale, state => states.push(state), { send: transport.send, getQuota: transport.getQuota, getVisitor: () => VISITOR_ID });
  await value.refreshQuota();
  return { value, ...transport, states, state: () => states.at(-1) };
}

test("does not send automatically; valid first send needs explicit consent", async () => {
  const h = await session();
  assert.equal(h.calls.length, 0);
  assert.equal(await h.value.submit("Bonjour", false), false);
  assert.equal(h.state().error, "consent");
  assert.equal(await h.value.submit("   ", true), false);
  assert.equal(h.state().consent, false);
  assert.equal(h.calls.length, 0);
});

test("user appears immediately; streaming text is transient until a complete pair commits", async () => {
  const h = await session("en");
  const result = h.value.submit(" Hello ", true);
  assert.equal(h.state().pending, "Hello");
  assert.equal(h.state().status, "sending");
  assert.equal(h.state().consent, true);
  assert.equal(h.calls[0].locale, "en");
  assert.equal(h.calls[0].consent, true);
  assert.deepEqual(plain(h.state().messages), []);
  h.calls[0].onText("Hel");
  assert.equal(h.state().partial, "Hel");
  assert.equal(await h.value.submit("duplicate", true), false);
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve("Hello back");
  assert.equal(await result, true);
  assert.deepEqual(plain(h.state().messages), [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hello back" }]);
  assert.equal(h.state().partial, "");
  assert.equal(h.state().pending, "");
});

test("failed streamed turn is discarded; retry sends only committed history and one user", async () => {
  const h = await session();
  let result = h.value.submit("First", true);
  h.calls[0].resolve("Reply"); await result;
  result = h.value.submit("Second", false);
  h.calls[1].onText("Incomplete");
  h.calls[1].reject(new DemoApiError("response"));
  assert.equal(await result, false);
  assert.equal(h.state().error, "response");
  assert.equal(h.state().messages.length, 2);
  assert.equal(h.state().partial, "");
  assert.equal(h.state().pending, "");
  await flush();
  const retry = h.value.submit("Second", false);
  assert.deepEqual(plain(h.calls[2].messages), [
    { role: "user", content: "First" }, { role: "assistant", content: "Reply" }, { role: "user", content: "Second" },
  ]);
  h.calls[2].resolve("Complete"); await retry;
  assert.equal(h.state().messages.length, 4);
});

for (const finish of ["resolve", "reject"]) {
  test(`cancel/retry ignores stale tokens and stale ${finish}, including the old finally`, async () => {
    const h = await session();
    const old = h.value.submit("Old", true);
    h.calls[0].onText("Partial");
    h.value.cancel(); await flush();
    assert.equal(h.calls[0].signal.aborted, true);
    assert.equal(h.state().status, "cancelled");
    const current = h.value.submit("Retry", false);
    const snapshot = h.state();
    h.calls[0].onText("Late token");
    h.calls[0][finish](finish === "resolve" ? "Late reply" : new Error("Late error"));
    await old;
    assert.equal(h.state(), snapshot);
    assert.equal(await h.value.submit("Duplicate", true), false);
    assert.equal(h.calls.length, 2);
    h.calls[1].resolve("New reply"); await current;
    assert.deepEqual(plain(h.state().messages), [{ role: "user", content: "Retry" }, { role: "assistant", content: "New reply" }]);
  });
}

test("clear preserves consent and quota; dispose aborts without publishing or future sends", async () => {
  const h = await session();
  const pending = h.value.submit("Hello", true);
  h.value.clear();
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(h.state().consent, true);
  await flush();
  h.calls[0].resolve("Old reply"); await pending;
  assert.deepEqual(plain(h.state().messages), []);
  const next = h.value.submit("Again", true);
  const count = h.states.length;
  h.value.dispose();
  assert.equal(h.calls[1].signal.aborted, true);
  h.calls[1].onText("After unmount");
  h.calls[1].resolve("After unmount"); await next;
  assert.equal(h.states.length, count);
  assert.equal(await h.value.submit("No", true), false);
});

test("15 completed pairs exhaust the quota, keeping every turn until an explicit clear", async () => {
  const h = await session();
  assert.equal(h.state().remaining, 15);
  for (let i = 0; i < 15; i++) {
    const result = h.value.submit(`Turn ${i}`, true);
    assert.equal(h.calls[i].messages.length, i * 2 + 1);
    h.calls[i].onText("Partial");
    assert.equal(h.state().remaining, 15 - i);
    h.calls[i].resolve(`Reply ${i}`); await result;
    assert.equal(h.state().remaining, 14 - i);
  }
  assert.equal(chat.chatCapacity(h.state().messages).full, true);
  assert.equal(await h.value.submit("Sixteenth", true), false);
  assert.equal(h.state().error, "exhausted");
  assert.equal(h.state().messages.length, 30);
  assert.equal(h.state().messages[0].content, "Turn 0");
  assert.equal(h.state().messages[29].content, "Reply 14");
  assert.equal(h.calls.length, 15);
  h.value.clear();
  assert.equal(chat.chatCapacity(h.state().messages).available, 2000);
  assert.equal(h.state().remaining, 0);
  assert.equal(h.state().consent, true);
});

test("all 15 maximum-sized turns fit the 120000-character budget without truncation", async () => {
  const h = await session();
  for (let i = 0; i < 15; i++) {
    assert.equal(chat.chatCapacity(h.state()?.messages ?? []).available, 2000);
    const result = h.value.submit("x".repeat(2000), true);
    assert.equal(h.calls[i].messages.reduce((sum, message) => sum + message.content.length, 0), i * 8000 + 2000);
    h.calls[i].resolve("y".repeat(6000)); await result;
  }
  assert.equal(h.state().messages.reduce((sum, message) => sum + message.content.length, 0), 120000);
  assert.equal(h.state().remaining, 0);
});

test("failures and cancellations do not consume even the final remaining reply", async () => {
  const h = await session();
  for (let i = 0; i < 14; i++) {
    const result = h.value.submit("Hello", true);
    h.calls[i].resolve("Reply"); await result;
  }
  let result = h.value.submit("Final", false);
  h.calls[14].onText("Partial");
  h.calls[14].reject(new DemoApiError("response")); await result; await flush();
  assert.equal(h.state().remaining, 1);
  result = h.value.submit("Final", false);
  h.calls[15].onText("Partial"); h.value.cancel(); await flush();
  h.calls[15].resolve("Stale"); await result;
  assert.equal(h.state().remaining, 1);
  result = h.value.submit("Final", false);
  assert.equal(h.calls[16].messages.length, 29);
  h.calls[16].resolve("Complete"); await result;
  assert.equal(h.state().remaining, 0);
  assert.equal(h.state().messages.length, 30);
});

test("oversized replies fail without committing malformed history", async () => {
  const h = await session();
  const first = h.value.submit("Hello", true);
  h.calls[0].resolve("x".repeat(6001)); await first;
  assert.equal(h.state().messages.length, 0);
  assert.equal(h.state().status, "error");
  assert.equal(h.quotaCalls.length, 2);
});
