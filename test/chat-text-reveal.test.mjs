import assert from "node:assert/strict";
import test from "node:test";
import { SmoothChatText, createChatTextReveal } from "../lib/chat-text-reveal.ts";
import { chat, deferredSend, flush, VISITOR_ID } from "./demo-chat-harness.mjs";

function clock() {
  let now = 0;
  let id = 0;
  const frames = new Map();
  return {
    now: () => now,
    request(callback) { frames.set(++id, callback); return id; },
    cancel(key) { frames.delete(key); },
    get pending() { return frames.size; },
    step(ms = 16) { now += ms; const next = [...frames.values()]; frames.clear(); next.forEach(callback => callback(now)); },
    drain() { for (let i = 0; frames.size && i < 1000; i++) this.step(); assert.equal(frames.size, 0); },
  };
}

test("irregular network chunks become small monotonic updates, not paragraph-sized jumps", async () => {
  const time = clock();
  const values = [];
  const reveal = new SmoothChatText(text => values.push(text), time);
  reveal.push("Bonjour, ".repeat(35));
  assert.equal(values.length, 0);
  for (let i = 0; i < 20; i++) time.step();
  assert.ok(values.length > 10);
  assert.ok(values.at(-1).length < 100);
  reveal.push("Bonjour, ".repeat(60));
  for (let i = 0; i < 20; i++) time.step();
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i].startsWith(values[i - 1]));
    assert.ok(values[i].length - values[i - 1].length <= 4);
  }
  const result = reveal.finish("Bonjour, ".repeat(60));
  time.drain(); await result;
  assert.equal(values.at(-1), "Bonjour, ".repeat(60));
  reveal.dispose();
});

test("emoji, combined accents and flags are never split by the animated reveal", async () => {
  const time = clock();
  const full = "👩🏽‍💻 café e\u0301 🇫🇷, à ton rythme.";
  const boundaries = new Set(Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(full), part => full.slice(0, part.index + part.segment.length)));
  const values = [];
  const reveal = new SmoothChatText(text => values.push(text), time);
  for (let i = 1; i <= full.length; i++) { reveal.push(full.slice(0, i)); time.drain(); }
  const result = reveal.finish(full); time.drain(); await result;
  for (const value of values) assert.ok(boundaries.has(value), JSON.stringify(value));
  assert.equal(values.at(-1), full);
});

test("a large final chunk drains within 1.5 seconds instead of minutes or an instant jump", async () => {
  const time = clock();
  const values = [];
  const reveal = new SmoothChatText(text => values.push(text), time);
  const result = reveal.finish("x".repeat(6000));
  time.step();
  assert.ok(values[0].length < 100);
  time.drain(); await result;
  assert.ok(time.now() <= 1520);
  assert.ok(values.length > 50);
  assert.equal(values.at(-1).length, 6000);
});

test("disposing cancels frames and resolves an unfinished drain without late writes", async () => {
  const time = clock();
  const values = [];
  const reveal = new SmoothChatText(text => values.push(text), time);
  const result = reveal.finish("A queued reply");
  reveal.dispose();
  assert.equal(time.pending, 0);
  await result;
  reveal.push("Late reply"); time.step();
  assert.deepEqual(values, []);
});

test("hidden/reduced-motion mode drains immediately and can return to gradual rendering", async () => {
  const time = clock();
  const values = [];
  const reveal = new SmoothChatText(text => values.push(text), time);
  reveal.push("Bonjour");
  reveal.setImmediate(true);
  assert.equal(time.pending, 0);
  assert.equal(values.at(-1), "Bonjour");
  reveal.push("Bonjour à toi");
  assert.equal(values.at(-1), "Bonjour à toi");
  reveal.setImmediate(false);
  reveal.push("Bonjour à toi, prends ton temps.");
  assert.equal(time.pending, 1);
  const result = reveal.finish("Bonjour à toi, prends ton temps.");
  time.drain(); await result;
  assert.equal(values.at(-1), "Bonjour à toi, prends ton temps.");
});

test("browser factory releases motion/visibility listeners and frames", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const time = clock();
  const motionListeners = new Map();
  const visibilityListeners = new Map();
  const motion = { matches: false, addEventListener: (name, fn) => motionListeners.set(name, fn), removeEventListener: name => motionListeners.delete(name) };
  globalThis.window = { requestAnimationFrame: time.request, cancelAnimationFrame: time.cancel, matchMedia: () => motion };
  globalThis.document = { visibilityState: "visible", addEventListener: (name, fn) => visibilityListeners.set(name, fn), removeEventListener: name => visibilityListeners.delete(name) };
  try {
    const values = [];
    const reveal = createChatTextReveal(text => values.push(text));
    reveal.push("Buffered");
    assert.equal(time.pending, 1);
    document.visibilityState = "hidden";
    visibilityListeners.get("visibilitychange")();
    assert.equal(values.at(-1), "Buffered");
    assert.equal(time.pending, 0);
    document.visibilityState = "visible";
    motion.matches = true;
    motionListeners.get("change")();
    reveal.push("Buffered and complete");
    assert.equal(values.at(-1), "Buffered and complete");
    reveal.dispose();
    assert.equal(motionListeners.size, 0);
    assert.equal(visibilityListeners.size, 0);
    assert.equal(time.pending, 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});

for (const action of ["complete", "cancel", "clear", "dispose", "failure"]) {
  test(`session ${action} owns its visual buffer and never commits incomplete text`, async () => {
    const time = clock();
    const transport = deferredSend();
    const states = [];
    const value = new chat.DemoChatSession("fr", state => states.push(state), {
      send: transport.send, getQuota: transport.getQuota, getVisitor: () => VISITOR_ID,
      reveal: emit => new SmoothChatText(emit, time),
    });
    await value.refreshQuota();
    const result = value.submit("Bonjour", true);
    transport.calls[0].onText("Une réponse assez longue pour se dérouler doucement.");
    time.step();
    assert.equal(states.at(-1).status, "sending");
    assert.equal(states.at(-1).messages.length, 0);
    if (action === "failure") transport.calls[0].reject(new Error("failed"));
    else transport.calls[0].resolve("Une réponse assez longue pour se dérouler doucement.");
    await flush();
    if (action === "complete") {
      assert.equal(states.at(-1).status, "sending");
      time.drain();
      assert.equal(await result, true);
      assert.equal(states.at(-1).messages[1].content, "Une réponse assez longue pour se dérouler doucement.");
      assert.equal(states.at(-1).remaining, 14);
    } else {
      if (action !== "failure") value[action]();
      assert.equal(await result, false);
      assert.equal(time.pending, 0);
      await flush();
      const after = states.length;
      time.step();
      assert.equal(states.length, after);
      assert.equal(states.at(-1).messages.length, 0);
      if (action !== "failure" && action !== "dispose") assert.equal(states.at(-1).remaining, 14, "cancelling the visual tail cannot refund an already completed server reply");
    }
    value.dispose();
    assert.equal(time.pending, 0);
  });
}
