import assert from "node:assert/strict";
import test from "node:test";
import { RelaxationSession, relaxationTime, formatRelaxationTime, relaxationPhrases } from "../lib/relaxation.ts";
import { audioHarness, deferred, flush } from "./relaxation-harness.mjs";

function setup() {
  const env = audioHarness();
  const states = [];
  const session = new RelaxationSession(state => states.push(state), env.deps);
  return { ...env, states, session, state: () => states.at(-1) };
}

test("monotonic deadline clamps time and maps five original bilingual slides", () => {
  assert.deepEqual(relaxationTime(120000, -1000), { remainingSeconds: 120, phrase: 0 });
  assert.deepEqual(relaxationTime(120000, 23999), { remainingSeconds: 97, phrase: 0 });
  assert.deepEqual(relaxationTime(120000, 24000), { remainingSeconds: 96, phrase: 1 });
  assert.deepEqual(relaxationTime(120000, 96000), { remainingSeconds: 24, phrase: 4 });
  assert.deepEqual(relaxationTime(120000, 130000), { remainingSeconds: 0, phrase: 4 });
  assert.equal(formatRelaxationTime(120), "2:00");
  assert.equal(formatRelaxationTime(9), "0:09");
  assert.equal(formatRelaxationTime(0), "0:00");
  for (const phrases of Object.values(relaxationPhrases)) {
    assert.equal(phrases.length, 5); assert.equal(new Set(phrases).size, 5);
    assert.ok(phrases.every(phrase => phrase.length < 65));
  }
});

test("explicit start creates one locally synthesized bed with audio-thread fade and hard cutoff", async () => {
  const env = setup();
  assert.equal(env.contexts.length, 0);
  const first = env.session.start(); void env.session.start();
  assert.equal(env.contexts.length, 1); assert.equal(env.contexts[0].resumeCalls, 1);
  await first;
  assert.equal(env.state().status, "playing");
  const [envelope, level] = env.contexts[0].nodes;
  assert.deepEqual(envelope.gain.events, [["set", 0, 0], ["ramp", 1, 1.2], ["set", 1, 118.8], ["ramp", 0, 120]]);
  assert.deepEqual(level.gain.events[0], ["set", 0.024, 0]);
  const sources = env.contexts[0].nodes.filter(node => node.oscillator);
  assert.equal(sources.length, 4);
  assert.deepEqual(sources.map(node => node.frequency.value), [174, 0.065, 261, 0.083]);
  assert.ok(sources.every(node => node.starts[0] === 0 && node.stops[0] === 120));
  env.session.setVolume(40);
  assert.deepEqual(level.gain.events.at(-1), ["target", 0.048, 0, 0.15]);
  assert.equal(envelope.gain.events.length, 4, "volume never cancels the deadline envelope");
  await env.session.dispose();
  assert.equal(env.contexts[0].state, "closed");
  assert.ok(env.contexts[0].nodes.every(node => node.disconnected));
  assert.equal(env.timers.size, 0);
});

test("delayed ticks catch up without drift, bounded React updates, finish and restart", async () => {
  const env = setup(); await env.session.start();
  const count = env.states.length;
  env.advance(250); env.advance(250);
  assert.equal(env.states.length, count, "no subsecond state emissions");
  env.advance(23500);
  assert.deepEqual(env.state(), { status: "playing", remainingSeconds: 96, phrase: 1 });
  env.advance(96000); await flush();
  assert.equal(env.state().status, "complete"); assert.equal(env.state().remainingSeconds, 0);
  assert.equal(env.timers.size, 0);
  await env.session.start();
  assert.deepEqual(env.state(), { status: "playing", remainingSeconds: 120, phrase: 0 });
  assert.equal(env.contexts.length, 2);
  await env.session.dispose();
});

test("audio ended callback completes even without a JS deadline tick", async () => {
  const env = setup(); await env.session.start();
  env.contexts[0].nodes.find(node => node.onended).onended(); await flush();
  assert.equal(env.state().status, "complete"); assert.equal(env.state().remainingSeconds, 0);
  assert.equal(env.timers.size, 0);
});

test("manual stop fades, prevents repeat starts until context close, then permits retry", async () => {
  const env = setup(); await env.session.start();
  const gate = deferred(); env.controls.close = gate;
  const stopped = env.session.stop();
  assert.equal(env.state().status, "stopping");
  assert.deepEqual(env.contexts[0].nodes[0].gain.events.at(-1), ["ramp", 0, 0.18]);
  await env.session.start(); assert.equal(env.contexts.length, 1);
  env.advance(200); await flush();
  const other = new RelaxationSession(() => {}, env.deps);
  await other.start(); assert.equal(env.contexts.length, 1, "cross-remount lease blocks overlapping contexts");
  gate.resolve(); await stopped; env.controls.close = null;
  assert.equal(env.state().status, "stopped");
  await other.start(); assert.equal(env.contexts.length, 2);
  await other.dispose();
});

test("hidden/unmount during a manual fade releases the fade timer and closes immediately", async () => {
  const env = setup(); await env.session.start();
  void env.session.stop(); const count = env.states.length;
  await env.session.dispose();
  assert.equal(env.timers.size, 0); assert.equal(env.contexts[0].state, "closed");
  assert.equal(env.states.length, count, "no updates after unmount");
  assert.ok(env.contexts[0].nodes.every(node => node.disconnected));
});

for (const mode of ["stop", "timeout", "dispose", "reject"]) {
  test(`${mode} during pending resume cannot resurrect audio`, async () => {
    const env = setup(); const gate = deferred(); env.controls.resume = gate;
    const start = env.session.start();
    if (mode === "stop") await env.session.stop(true);
    if (mode === "dispose") await env.session.dispose();
    if (mode === "timeout") { env.advance(10000); await flush(); }
    if (mode === "reject") gate.reject(Error("blocked")); else gate.resolve();
    await start; await flush();
    assert.equal(env.contexts[0].state, "closed");
    assert.equal(env.contexts[0].nodes.length, 0); assert.equal(env.timers.size, 0);
    assert.notEqual(env.state().status, "playing");
    if (mode === "timeout" || mode === "reject") {
      assert.equal(env.state().status, "error"); env.controls.resume = null;
      await env.session.start(); assert.equal(env.state().status, "playing");
      await env.session.dispose();
    }
  });
}

test("unsupported audio, partial graph errors and interrupted output clean up and allow retry", async () => {
  const env = setup(); env.controls.createError = true;
  await env.session.start(); assert.equal(env.state().status, "error");
  env.controls.createError = false; env.controls.nodeError = true;
  await env.session.start(); assert.equal(env.contexts[0].state, "closed");
  assert.ok(env.contexts[0].nodes.every(node => node.disconnected));
  env.controls.nodeError = false; await env.session.start();
  const active = env.contexts.at(-1); active.state = "suspended"; active.onstatechange();
  await flush(); assert.equal(env.state().status, "error");
  assert.equal(active.state, "closed"); assert.equal(env.timers.size, 0);
  await env.session.start(); await env.session.dispose();
});
