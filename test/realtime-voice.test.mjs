import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { RealtimeVoiceSession } from "../lib/realtime-voice.ts";

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function environment(t, config = {}) {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 10_000 });
  const env = { clock: 10_000, order: [], contexts: [], sockets: [], worklets: [], sessions: [], states: [] };
  t.mock.method(performance, "now", () => env.clock);
  const globals = new Map();
  function replace(name, value) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  class Node {
    connect(target) { this.connected = true; (this.connections ??= []).push(target); }
    disconnect() { this.disconnected = true; }
  }
  class Source extends Node {
    start(at) { this.startAt = at; }
    stop() { this.stopped = true; }
  }
  class Context {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = config.sampleRate ?? 48000;
      this.baseLatency = 0.02;
      this.outputLatency = 0.03;
      this.state = "suspended";
      this.destination = {};
      this.sources = [];
      this.analysers = [];
      this.audioWorklet = { addModule: async (url) => {
        assert.equal(url, "/audio/nexo-pcm-worklet.js");
        if (config.module) await config.module;
      } };
      env.contexts.push(this);
    }
    resume() {
      env.order.push("resume");
      this.state = "running";
      return config.resume ?? Promise.resolve();
    }
    close() { this.closed = true; this.state = "closed"; return Promise.resolve(); }
    createMediaStreamSource() { this.input = new Node(); return this.input; }
    createAnalyser() {
      const analyser = new Node();
      analyser.samples = new Float32Array(256);
      analyser.getFloatTimeDomainData = samples => samples.set(analyser.samples);
      analyser.frequency = new Float32Array(128).fill(-Infinity);
      analyser.getFloatFrequencyData = bins => bins.set(analyser.frequency);
      this.analysers.push(analyser);
      return analyser;
    }
    createBuffer(channels, length, rate) {
      assert.equal(channels, 1);
      assert.equal(rate, 24000);
      const samples = new Float32Array(length);
      return { samples, getChannelData: () => samples };
    }
    createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  }
  class Worklet extends Node {
    constructor(context, name) {
      super();
      assert.equal(name, "nexo-pcm");
      this.messages = [];
      this.port = {
        onmessage: null,
        postMessage: (data) => { this.messages.push(data); },
        close: () => { this.port.closed = true; },
      };
      env.worklets.push(this);
    }
  }
  class Socket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.bufferedAmount = 0;
      this.sent = [];
      env.sockets.push(this);
    }
    open() { this.readyState = 1; this.onopen?.({}); }
    receive(data) { this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) }); }
    send(data) { if (config.sendThrows) throw new Error("send failed"); this.sent.push(typeof data === "string" ? JSON.parse(data) : data); }
    close() { this.closed = true; this.readyState = 3; }
  }
  env.track = { enabled: true, stop() { this.stopped = true; } };
  env.stream = { getTracks: () => [env.track], getAudioTracks: () => [env.track] };
  replace("AudioContext", Context);
  replace("AudioWorkletNode", Worklet);
  replace("WebSocket", Socket);
  replace("navigator", { mediaDevices: { getUserMedia: (constraints) => {
    env.order.push("microphone");
    assert.deepEqual(constraints, { audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false });
    return config.permission ?? Promise.resolve(env.stream);
  } } });
  env.document = new EventTarget();
  env.document.visibilityState = "visible";
  env.window = new EventTarget();
  replace("document", env.document);
  replace("window", env.window);
  env.session = (overrides = {}) => {
    const session = new RealtimeVoiceSession({
      locale: "fr", consent: true, apiBase: "", onState: (state) => env.states.push(state), ...overrides,
    });
    env.sessions.push(session);
    return session;
  };
  env.advance = (ms) => { env.clock += ms; t.mock.timers.tick(ms); };
  env.connect = async (session = env.session()) => {
    const started = session.start();
    await flush();
    const socket = env.sockets.at(-1);
    socket.open();
    socket.receive({ type: "ready", max_seconds: 120 });
    await started;
    return { session, socket, context: env.contexts.at(-1), worklet: env.worklets.at(-1) };
  };
  env.last = () => env.states.at(-1);
  t.after(() => {
    for (const session of env.sessions) session.stop();
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return env;
}
function pcm(seconds = 0.1) { return Buffer.alloc(Math.round(seconds * 24000) * 2).toString("base64"); }
function play(socket, id = "reply-1", seconds = 0.1) { socket.receive({ type: "audio", item_id: id, audio: pcm(seconds) }); }
function capture(worklet, bytes = new ArrayBuffer(4800), generation) {
  const current = worklet.messages.findLast((message) => message.type === "capture");
  worklet.port.onmessage?.({ data: { type: "pcm", generation: generation ?? current.generation, pcm: bytes } });
}
function assertClosed(env) {
  assert.ok(env.contexts.every((context) => context.closed));
  assert.ok(env.sockets.every((socket) => socket.closed));
  assert.ok(env.worklets.every((worklet) => worklet.disconnected && worklet.port.closed && worklet.port.onmessage === null));
  if (env.order.includes("microphone")) assert.equal(env.track.stopped, true);
}

test("waveform uses real input and output samples without microphone monitoring", async (t) => {
  const env = environment(t);
  const frames = [];
  const borrowed = [];
  const session = env.session({ onWaveform: frame => {
    borrowed.push([frame, frame.input, frame.output, frame.inputFrequency, frame.outputFrequency]);
    frames.push({ input: [...frame.input], output: [...frame.output], inputFrequency: [...frame.inputFrequency], outputFrequency: [...frame.outputFrequency], sampleRate: frame.sampleRate });
  } });
  assert.equal(frames.length, 0);
  const { socket, context, worklet } = await env.connect(session);
  const [input, output] = context.analysers;
  assert.equal(input.fftSize, 256);
  assert.equal(output.fftSize, 256);
  assert.equal(input.smoothingTimeConstant, 0);
  assert.equal(output.smoothingTimeConstant, 0);
  assert.equal(frames.at(-1).sampleRate, 48000);
  assert.equal(frames.at(-1).inputFrequency.length, 128);
  assert.deepEqual(context.input.connections, [input]);
  assert.deepEqual(input.connections, [worklet]);
  assert.deepEqual(output.connections, [context.destination]);
  assert.ok(frames.at(-1).input.every(sample => sample === 0));
  input.samples.fill(0.25);
  input.frequency.fill(-24);
  output.samples.fill(-0.5);
  output.frequency.fill(-12);
  env.advance(34);
  assert.ok(frames.at(-1).input.every(sample => sample === 0.25));
  assert.ok(frames.at(-1).output.every(sample => sample === 0));
  play(socket, "a", 1);
  assert.deepEqual(context.sources[0].connections, [output]);
  env.advance(34);
  assert.ok(frames.at(-1).output.every(sample => sample === 0), "queued audio does not animate before playback starts");
  assert.ok(frames.at(-1).outputFrequency.every(db => db === -Infinity));
  context.currentTime = 0.1;
  env.advance(34);
  assert.ok(frames.at(-1).output.every(sample => sample === -0.5));
  assert.ok(frames.at(-1).inputFrequency.every(db => db === -24));
  assert.ok(frames.at(-1).outputFrequency.every(db => db === -12));
  session.setMuted(true);
  assert.ok(frames.at(-1).input.every(sample => sample === 0));
  assert.ok(frames.at(-1).inputFrequency.every(db => db === -Infinity));
  assert.ok(frames.at(-1).outputFrequency.every(db => db === -12));
  assert.ok(frames.at(-1).output.every(sample => sample === -0.5));
  socket.receive({ type: "speech_started" });
  assert.ok(frames.at(-1).output.every(sample => sample === 0));
  session.setMuted(false);
  assert.ok(frames.at(-1).input.every(sample => sample === 0.25));
  context.state = "suspended";
  env.advance(34);
  assert.ok(frames.at(-1).input.every(sample => sample === 0));
  context.state = "running";
  session.stop();
  assert.ok(frames.at(-1).input.every(sample => sample === 0));
  assert.ok(frames.at(-1).output.every(sample => sample === 0));
  assert.ok(context.analysers.every(analyser => analyser.disconnected));
  assert.ok(frames.at(-1).inputFrequency.every(db => db === -Infinity));
  assert.ok(frames.at(-1).outputFrequency.every(db => db === -Infinity));
  assert.ok(borrowed.every(refs => refs.every((ref, index) => ref === borrowed[0][index])), "all temporal/frequency buffers and the frame object are reused");
  assert.equal(env.contexts.length, 1);
  assert.equal(env.order.filter(item => item === "microphone").length, 1);
  const count = frames.length;
  env.advance(1000);
  assert.equal(frames.length, count);
  assertClosed(env);
});

test("frequency read failures, completed playback and terminal paths never retain measured energy", async (t) => {
  const env = environment(t, { sampleRate: 44100 });
  for (const terminal of ["stop", "hidden", "error", "deadline"]) {
    let latest;
    const session = env.session({ onWaveform: value => { latest = value; } });
    const { socket, context } = await env.connect(session);
    const [input, output] = context.analysers;
    input.samples.fill(0.2); input.frequency.fill(-20);
    output.samples.fill(0.3); output.frequency.fill(-10);
    play(socket, "fixture", 0.1); context.currentTime = 0.05; env.advance(34);
    assert.equal(latest.sampleRate, 44100);
    assert.ok(latest.outputFrequency.every(db => db === -10));
    context.currentTime = 0.2; env.advance(34);
    assert.ok(latest.outputFrequency.every(db => db === -Infinity), "completed PCM is silent even before playback pruning");
    input.getFloatFrequencyData = () => { throw new Error("analyser unavailable"); };
    env.advance(34);
    assert.ok(latest.inputFrequency.every(db => db === -Infinity), "failed spectrum read cannot reuse an old frame");
    if (terminal === "stop") session.stop();
    if (terminal === "hidden") { env.document.visibilityState = "hidden"; env.document.dispatchEvent(new Event("visibilitychange")); }
    if (terminal === "error") socket.receive({ type: "error", code: "connection" });
    if (terminal === "deadline") env.advance(120_000);
    assert.ok(latest.input.every(value => value === 0));
    assert.ok(latest.inputFrequency.every(db => db === -Infinity));
    assert.ok(latest.outputFrequency.every(db => db === -Infinity));
    assertClosed(env);
    env.document.visibilityState = "visible";
  }
});

test("waveform is optional and never requests microphone permission without consent", async (t) => {
  const env = environment(t);
  const { context } = await env.connect();
  assert.equal(context.analysers.length, 0);
  let frames = 0;
  const refused = env.session({ consent: false, onWaveform: () => frames++ });
  await refused.start();
  assert.equal(env.contexts.length, 1);
  const count = frames;
  env.advance(1000);
  assert.equal(frames, count);
});

test("waveform observer exceptions and reentrant stop cannot leak audio resources", async (t) => {
  const env = environment(t);
  const session = env.session({ onWaveform: () => { throw new Error("renderer failed"); } });
  const { context } = await env.connect(session);
  context.analysers[0].getFloatTimeDomainData = () => { throw new Error("closed analyser"); };
  env.advance(100);
  assert.equal(env.last().status, "listening");
  session.stop();
  let calls = 0;
  const reentrant = env.session({ onWaveform: () => { calls++; reentrant.stop(); } });
  await env.connect(reentrant);
  assert.equal(env.last().status, "ended");
  const count = calls;
  env.advance(1000);
  assert.equal(calls, count);
  assertClosed(env);
});

test("consent gates all browser resources and unsupported browsers fail safely", async (t) => {
  const env = environment(t);
  await env.session({ consent: false }).start();
  assert.equal(env.last().error, "protocol");
  assert.equal(env.contexts.length, 0);
  assert.equal(env.order.length, 0);
  globalThis.AudioWorkletNode = undefined;
  await env.session().start();
  assert.equal(env.last().error, "unsupported");
  assert.equal(env.contexts.length, 0);
});

test("resume runs synchronously on the start stack; start is idempotent and handshake is exact", async (t) => {
  const permission = deferred();
  const env = environment(t, { permission: permission.promise });
  const session = env.session({ locale: "en", apiBase: "https://api.example.test/ignored/" });
  const started = session.start();
  assert.deepEqual(env.order, ["resume", "microphone"]);
  assert.equal(session.start(), started);
  assert.equal(env.last().status, "connecting");
  permission.resolve(env.stream);
  await flush();
  const socket = env.sockets[0];
  assert.equal(socket.url, "wss://api.example.test/api/v1/landing/demo/realtime");
  socket.open();
  assert.deepEqual(socket.sent, [{ type: "start", locale: "en", consent: true }]);
  socket.receive({ type: "ready", max_seconds: 120 });
  await started;
  assert.deepEqual(env.last(), { status: "listening", muted: false, remainingSeconds: 120 });
  session.stop();
  assert.deepEqual(socket.sent.at(-1), { type: "stop" });
  assertClosed(env);
  assert.equal(env.last().reason, "stopped");
  await session.start();
  assert.equal(env.contexts.length, 1);
});

test("fallback WS URL and capture contain only consented PCM; mute gates tracks and stale chunks", async (t) => {
  const env = environment(t);
  const { session, socket, worklet } = await env.connect();
  assert.equal(socket.url, "ws://127.0.0.1:8787/api/v1/landing/demo/realtime");
  const bytes = Uint8Array.of(0, 128, 255, 127).buffer;
  capture(worklet, bytes);
  assert.ok(socket.sent.at(-1) instanceof ArrayBuffer);
  assert.deepEqual(new Uint8Array(socket.sent.at(-1)), new Uint8Array(bytes));
  const oldGeneration = worklet.messages.findLast((message) => message.type === "capture").generation;
  session.setMuted(true);
  assert.equal(env.track.enabled, false);
  capture(worklet);
  capture(worklet, bytes, oldGeneration);
  assert.equal(socket.sent.length, 3);
  assert.deepEqual(socket.sent.at(-1), { type: "mute", muted: true });
  session.setMuted(false);
  assert.equal(env.track.enabled, true);
  capture(worklet, bytes, oldGeneration);
  assert.equal(socket.sent.length, 4);
  assert.deepEqual(socket.sent.at(-1), { type: "mute", muted: false });
  capture(worklet, bytes);
  assert.equal(socket.sent.length, 5);
});

test("mute before permission is applied to acquired tracks and worklet", async (t) => {
  const permission = deferred();
  const env = environment(t, { permission: permission.promise });
  const session = env.session();
  session.start();
  session.setMuted(true);
  permission.resolve(env.stream);
  await flush();
  assert.equal(env.track.enabled, false);
  const socket = env.sockets[0];
  socket.open(); socket.receive({ type: "ready", max_seconds: 120 });
  assert.equal(env.worklets[0].messages.at(-1).enabled, false);
  assert.equal(env.last().muted, true);
});

for (const apiBase of ["https://user:pass@example.test", "https://example.test?token=secret", "https://example.test#secret", "ftp://example.test", "not a URL"]) {
  test(`rejects unsafe/invalid API base ${apiBase.split(":")[0]}`, async (t) => {
    const env = environment(t);
    await env.session({ apiBase }).start();
    assert.equal(env.last().error, "protocol");
    assert.equal(env.contexts.length, 0);
  });
}

test("interrupt duration excludes queued audio and output latency; late audio is suppressed", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  play(socket, "a", 1); play(socket, "a", 1);
  const start = context.sources[0].startAt;
  context.currentTime = start + 0.55;
  socket.receive({ type: "speech_started" });
  assert.deepEqual(socket.sent.at(-1), { type: "interrupt", item_id: "a", audio_end_ms: 500 });
  assert.equal(env.last().status, "listening");
  assert.ok(context.sources.every((source) => source.stopped && source.disconnected && source.buffer === null));
  play(socket, "a", 1);
  assert.equal(context.sources.length, 2);
  socket.receive({ type: "audio_done", item_id: "a" });
  socket.receive({ type: "speech_stopped" });
  assert.equal(env.last().status, "listening");
  play(socket, "b");
  assert.equal(env.last().status, "speaking");
});

test("output timestamp measures heard duration; even a queued-only item interrupts at zero", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  play(socket, "a", 1); play(socket, "b", 1);
  context.currentTime = 0.9;
  context.getOutputTimestamp = () => ({ contextTime: 0.265, performanceTime: env.clock });
  socket.receive({ type: "speech_started" });
  assert.deepEqual(socket.sent.slice(-2), [
    { type: "interrupt", item_id: "a", audio_end_ms: 250 },
    { type: "interrupt", item_id: "b", audio_end_ms: 0 },
  ]);
});

test("playback position excludes scheduling gaps and survives pruning of finished chunks", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  play(socket, "a", 0.1);
  context.currentTime = 1;
  env.advance(250);
  assert.equal(env.last().status, "listening");
  play(socket, "a", 1);
  context.currentTime = 1.565;
  socket.receive({ type: "speech_started" });
  const duration = socket.sent.at(-1).audio_end_ms;
  assert.ok(duration >= 599 && duration <= 600, `${duration}ms`);
});

test("audio_done does not truncate scheduled playback and PCM16 is decoded little endian", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  socket.receive({ type: "audio", item_id: "a", audio: "AID/fw==" });
  assert.deepEqual([...context.sources[0].buffer.samples], [-1, 32767 / 32768]);
  socket.receive({ type: "audio_done", item_id: "a" });
  assert.equal(env.last().status, "speaking");
  assert.equal(context.sources[0].stopped, undefined);
  context.currentTime = 0.2;
  env.advance(250);
  assert.equal(env.last().status, "listening");
});

test("a suspended context cannot count queued audio as heard", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  play(socket, "a", 1);
  context.state = "suspended";
  context.getOutputTimestamp = () => ({ contextTime: 0, performanceTime: env.clock - 500 });
  env.advance(500);
  socket.receive({ type: "speech_started" });
  assert.equal(socket.sent.at(-1).audio_end_ms, 0);
});

for (const data of ["{", "null", "[]", "42", "{}", "x".repeat(132001),
  { type: "unknown" }, { type: "ready", max_seconds: 120 },
  { type: "audio", item_id: "", audio: pcm() }, { type: "audio", item_id: "a", audio: "AA==" },
  { type: "audio", item_id: "a", audio: "***=" }, { type: "audio", item_id: "a", audio: "AAA" },
  { type: "audio", item_id: "a", audio: "AAB=" }, { type: "audio", item_id: "a", audio: 12 },
  { type: "audio_done" }, { type: "audio_done", item_id: {} }, { type: "error", code: "private-detail" }, { type: "ended", reason: "invalid" }]) {
  test(`malformed server message fails closed (${typeof data === "string" ? data.slice(0, 15) : JSON.stringify(data).slice(0, 70)})`, async (t) => {
    const env = environment(t);
    const { socket } = await env.connect();
    socket.receive(data);
    assert.equal(env.last().error, "protocol");
    assertClosed(env);
    assert.ok(!JSON.stringify(env.states).includes("private-detail"));
  });
}

test("binary WS messages fail closed", async (t) => {
  const env = environment(t);
  const { socket } = await env.connect();
  socket.onmessage({ data: new ArrayBuffer(4) });
  assert.equal(env.last().error, "protocol");
  assertClosed(env);
});

for (const max_seconds of [undefined, 0, -1, 121, 1.5, "120"]) {
  test(`invalid ready budget ${max_seconds} fails closed`, async (t) => {
    const env = environment(t);
    const session = env.session();
    const started = session.start();
    await flush();
    const socket = env.sockets[0];
    socket.open(); socket.receive({ type: "ready", max_seconds });
    await started;
    assert.equal(env.last().error, "protocol");
    assertClosed(env);
  });
}

test("audio before ready is a protocol error", async (t) => {
  const env = environment(t);
  const started = env.session().start();
  await flush();
  env.sockets[0].open(); play(env.sockets[0]);
  await started;
  assert.equal(env.last().error, "protocol");
  assertClosed(env);
});

for (const code of ["unavailable", "connection", "protocol", "limit", "rate_limited", "busy"]) {
  test(`server error ${code} is preserved with complete cleanup`, async (t) => {
    const env = environment(t);
    const { socket } = await env.connect();
    play(socket);
    socket.receive({ type: "error", code, message: "must not escape" });
    assert.equal(env.last().error, code);
    assertClosed(env);
    assert.ok(!JSON.stringify(env.states).includes("must not escape"));
  });
}
for (const code of ["rate_limited", "busy"]) {
  test(`admission rejection ${code} closes microphone before ready`, async (t) => {
    const env = environment(t);
    const started = env.session().start();
    await flush();
    const socket = env.sockets.at(-1);
    socket.open();
    socket.receive({ type: "error", code });
    await started;
    assert.equal(env.last().error, code);
    assert.equal(env.last().remainingSeconds, 120);
    assertClosed(env);
  });
}
for (const reason of ["time_limit", "stopped"]) {
  test(`server ended ${reason} closes resources`, async (t) => {
    const env = environment(t);
    const { socket } = await env.connect();
    socket.receive({ type: "ended", reason });
    assert.equal(env.last().reason, reason);
    assertClosed(env);
  });
}

test("a normal spoken response generated ahead of playback does not end the session", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  for (let i = 0; i < 300; i++) play(socket, "a", 0.1);
  socket.receive({ type: "audio_done", item_id: "a" });
  assert.equal(env.last().error, undefined);
  assert.equal(env.last().status, "speaking");
  assert.equal(context.sources.length, 300);
  context.currentTime = 31;
  env.advance(31_000);
  assert.equal(env.last().status, "listening");
  assert.equal(env.last().remainingSeconds, 89);
  assert.equal(socket.closed, undefined);
});

test("barge-in discards a fast-generated response without counting unheard audio", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  for (let i = 0; i < 300; i++) play(socket, "a", 0.1);
  context.currentTime = 2.565;
  socket.receive({ type: "speech_started" });
  const interrupt = socket.sent.at(-1);
  assert.equal(interrupt.type, "interrupt");
  assert.equal(interrupt.item_id, "a");
  assert.ok(interrupt.audio_end_ms >= 2499 && interrupt.audio_end_ms <= 2500);
  assert.equal(env.last().status, "listening");
  assert.ok(context.sources.slice(25).every(source => source.stopped && source.disconnected));
  play(socket, "a");
  assert.equal(context.sources.length, 300);
  play(socket, "b");
  assert.equal(env.last().status, "speaking");
  assert.equal(env.last().error, undefined);
});

test("session deadline still stops a long queued response at two minutes", async (t) => {
  const env = environment(t);
  const { socket } = await env.connect();
  env.advance(110_000);
  for (let i = 0; i < 300; i++) play(socket, "a", 0.1);
  assert.equal(env.last().status, "speaking");
  env.advance(10_000);
  assert.equal(env.last().reason, "time_limit");
  assert.equal(env.last().remainingSeconds, 0);
  assertClosed(env);
});

test("speaker queue has a time bound", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  for (let i = 0; i < 61; i++) play(socket, "a", 2);
  assert.equal(env.last().error, "limit");
  assert.ok(context.sources.length < 61);
  assertClosed(env);
});

test("tiny speaker packets have a node-count bound", async (t) => {
  const env = environment(t);
  const { socket, context } = await env.connect();
  for (let i = 0; i < 4097; i++) socket.receive({ type: "audio", item_id: "a", audio: "AAA=" });
  assert.equal(env.last().error, "limit");
  assert.equal(context.sources.length, 4096);
  assertClosed(env);
});

test("socket backpressure fails rather than accumulating or silently dropping audio", async (t) => {
  const env = environment(t);
  const { socket, worklet } = await env.connect();
  socket.bufferedAmount = 64 * 1024 - 100;
  capture(worklet);
  assert.equal(env.last().error, "limit");
  assert.equal(socket.sent.length, 2);
  assert.deepEqual(socket.sent.at(-1), { type: "stop" });
  assert.ok(socket.sent.every(message => !(message instanceof ArrayBuffer)));
  assertClosed(env);
});

for (const bytes of [0, 1, 4802]) {
  test(`invalid capture chunk size ${bytes} is rejected`, async (t) => {
    const env = environment(t);
    const { worklet } = await env.connect();
    capture(worklet, new ArrayBuffer(bytes));
    assert.equal(env.last().error, "protocol");
    assertClosed(env);
  });
}

test("permission timeout resolves start and stops a late microphone stream", async (t) => {
  const permission = deferred();
  const env = environment(t, { permission: permission.promise });
  const started = env.session().start();
  env.advance(15_000);
  await started;
  assert.equal(env.last().error, "timeout");
  assert.equal(env.contexts[0].closed, true);
  permission.resolve(env.stream);
  await flush();
  assertClosed(env);
  assert.equal(env.sockets.length, 0);
});

test("stop during permission is terminal; late rejection is handled", async (t) => {
  const permission = deferred();
  const env = environment(t, { permission: permission.promise });
  const session = env.session();
  const started = session.start();
  session.stop();
  await started;
  permission.reject(new Error("denied later"));
  await flush();
  assert.equal(env.last().reason, "stopped");
  assert.equal(env.sockets.length, 0);
});

test("stop during permission stops a late resolved stream and cannot restart", async (t) => {
  const permission = deferred();
  const env = environment(t, { permission: permission.promise });
  const session = env.session();
  const started = session.start();
  session.stop();
  await started;
  permission.resolve(env.stream);
  await flush();
  await session.start();
  assert.equal(env.last().reason, "stopped");
  assert.equal(env.sockets.length, 0);
  assertClosed(env);
});

test("stop while socket connects guards retained callbacks and capture", async (t) => {
  const env = environment(t);
  const session = env.session();
  const started = session.start();
  await flush();
  const socket = env.sockets[0];
  const lateOpen = socket.onopen;
  const lateMessage = socket.onmessage;
  const lateCapture = env.worklets[0].port.onmessage;
  session.stop();
  await started;
  lateOpen({});
  lateMessage({ data: JSON.stringify({ type: "ready", max_seconds: 120 }) });
  lateCapture({ data: { type: "pcm", generation: 1, pcm: new ArrayBuffer(4800) } });
  assert.equal(socket.sent.length, 0);
  assert.equal(env.last().reason, "stopped");
  assertClosed(env);
});

test("permission denial becomes microphone error", async (t) => {
  const permission = deferred();
  const env = environment(t, { permission: permission.promise });
  const started = env.session().start();
  permission.reject(new Error("permission denied"));
  await started;
  assert.equal(env.last().error, "microphone");
  assert.equal(env.contexts[0].closed, true);
});

test("resume rejection is handled even while permission remains pending", async (t) => {
  const resume = deferred(), permission = deferred();
  const env = environment(t, { resume: resume.promise, permission: permission.promise });
  const started = env.session().start();
  resume.reject(new Error("not allowed"));
  await started;
  assert.equal(env.last().error, "unsupported");
  permission.resolve(env.stream);
  await flush();
  assertClosed(env);
});

test("worklet setup timeout and late module resolution never construct a socket", async (t) => {
  const pendingModule = deferred();
  const env = environment(t, { module: pendingModule.promise });
  const started = env.session().start();
  await flush();
  env.advance(10_000);
  await started;
  pendingModule.resolve();
  await flush();
  assert.equal(env.last().error, "timeout");
  assert.equal(env.sockets.length, 0);
  assertClosed(env);
});

for (const opened of [false, true]) {
  test(`connect/ready timeout (opened=${opened}) cleans up and guards stale handlers`, async (t) => {
    const env = environment(t);
    const started = env.session().start();
    await flush();
    const socket = env.sockets[0];
    if (opened) socket.open();
    const lateOpen = socket.onopen, lateMessage = socket.onmessage, lateError = socket.onerror;
    env.advance(10_000);
    await started;
    const states = env.states.length;
    lateOpen({}); lateMessage({ data: JSON.stringify({ type: "ready", max_seconds: 120 }) }); lateError({});
    assert.equal(env.states.length, states);
    assert.equal(env.last().error, "timeout");
    assertClosed(env);
  });
}

for (const event of ["onerror", "onclose"]) {
  test(`unexpected socket ${event} reports connection and tears down`, async (t) => {
    const env = environment(t);
    const { socket } = await env.connect();
    socket[event]({});
    assert.equal(env.last().error, "connection");
    assertClosed(env);
  });
}

test("synchronous send failure is contained", async (t) => {
  const env = environment(t, { sendThrows: true });
  const started = env.session().start();
  await flush();
  env.sockets[0].open();
  await started;
  assert.equal(env.last().error, "connection");
  assertClosed(env);
});

test("120-second wall-clock budget starts at click, not ready", async (t) => {
  const permission = deferred();
  const env = environment(t, { permission: permission.promise });
  const session = env.session();
  const started = session.start();
  env.advance(5000);
  permission.resolve(env.stream);
  await flush();
  env.sockets[0].open(); env.sockets[0].receive({ type: "ready", max_seconds: 120 });
  await started;
  assert.equal(env.last().remainingSeconds, 115);
  env.advance(114_999);
  assert.notEqual(env.last().status, "ended");
  env.advance(1);
  assert.deepEqual(env.last(), { status: "ended", muted: false, remainingSeconds: 0, reason: "time_limit" });
  assertClosed(env);
});

test("a shorter server budget is respected", async (t) => {
  const env = environment(t);
  const started = env.session().start();
  await flush();
  const socket = env.sockets[0];
  socket.open(); socket.receive({ type: "ready", max_seconds: 20 });
  await started;
  assert.equal(env.last().remainingSeconds, 20);
  env.advance(20_000);
  assert.equal(env.last().reason, "time_limit");
  assertClosed(env);
});

test("deadline check prevents capture after timers were throttled", async (t) => {
  const env = environment(t);
  const { socket, worklet } = await env.connect();
  env.clock += 121_000;
  capture(worklet);
  assert.equal(socket.sent.length, 2);
  assert.deepEqual(socket.sent.at(-1), { type: "stop" });
  assert.ok(socket.sent.every(message => !(message instanceof ArrayBuffer)));
  assert.equal(env.last().reason, "time_limit");
  assertClosed(env);
});

for (const event of ["visibilitychange", "pagehide"]) {
  test(`${event} stops session and listeners are removed`, async (t) => {
    const env = environment(t);
    await env.connect();
    env.document.visibilityState = "hidden";
    const target = event === "pagehide" ? env.window : env.document;
    target.dispatchEvent(new Event(event));
    assert.equal(env.last().reason, "stopped");
    assertClosed(env);
    const count = env.states.length;
    target.dispatchEvent(new Event(event));
    env.advance(121_000);
    assert.equal(env.states.length, count);
  });
}

test("hidden at start does not request the microphone", async (t) => {
  const env = environment(t);
  env.document.visibilityState = "hidden";
  await env.session().start();
  assert.equal(env.last().reason, "stopped");
  assert.deepEqual(env.order, ["resume"]);
  assertClosed(env);
});

test("track loss and worklet failure are terminal", async (t) => {
  const env = environment(t);
  await env.connect();
  env.track.onended();
  assert.equal(env.last().error, "microphone");
  assertClosed(env);
  const next = await env.connect();
  next.worklet.onprocessorerror();
  assert.equal(env.last().error, "unsupported");
  assertClosed(env);
});

test("callback exceptions cannot leak resources; reentrant stop prevents microphone acquisition", async (t) => {
  const env = environment(t);
  let session;
  session = env.session({ onState(state) { if (state.status === "connecting") session.stop(); throw new Error("UI callback"); } });
  await session.start();
  assert.deepEqual(env.order, ["resume"]);
  assertClosed(env);
});

test("voice keeps concise consent while detailed disclosures live in linked terms", async () => {
  const [voice, policy] = await Promise.all([
    readFile(new URL("../components/realtime-voice.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/policy.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(voice, /Azure|t\.(?:intro|notice|help|privacyStop)/);
  assert.match(voice, /Accepter et commencer/);
  assert.match(voice, /Agree and start/);
  assert.match(voice, /href="\/conditions#conversation-vocale"/);
  assert.match(voice, /aria-describedby=\{consentId\}/);
  assert.match(voice, /onClick=\{start\}/);
  assert.doesNotMatch(voice, /type="checkbox"/);
  const terms = policy.split("  ] : [")[1];
  assert.match(terms, /"conversation-vocale"/);
  assert.match(terms, /id=\{id\}/);
  for (const detail of ["Microsoft Azure", "transmis en continu", "continuously streams", "sans sous-titres ni transcription", "without captions or transcripts", "masquer l’onglet", "hiding the tab", "Aucun redémarrage automatique", "Nothing restarts automatically"]) {
    assert.ok(terms.includes(detail), `Missing voice disclosure: ${detail}`);
  }
});

const workletSource = await readFile(new URL("../public/audio/nexo-pcm-worklet.js", import.meta.url), "utf8");
function processor(rate) {
  let Processor;
  const sent = [];
  class Base {
    constructor() {
      this.port = { postMessage: (data, transfer) => {
        assert.equal(transfer[0], data.pcm);
        sent.push(data);
      }, close() { this.closed = true; } };
    }
  }
  vm.runInNewContext(workletSource, {
    AudioWorkletProcessor: Base, sampleRate: rate,
    registerProcessor(name, implementation) { assert.equal(name, "nexo-pcm"); Processor = implementation; },
  });
  const instance = new Processor();
  const message = (data) => instance.port.onmessage?.({ data });
  message({ type: "capture", enabled: true, generation: 1 });
  function render(channels, acknowledge = true) {
    const previous = sent.length;
    const output = new Float32Array(channels[0]?.length ?? 128).fill(1);
    const result = instance.process([channels], [[output]]);
    assert.ok(output.every((sample) => sample === 0), "never monitors microphone");
    if (acknowledge) for (let i = previous; i < sent.length; i++) message({ type: "ack", generation: sent[i].generation });
    return result;
  }
  return { instance, sent, message, render };
}

for (const rate of [16000, 24000, 44100, 48000, 96000]) {
  test(`worklet resamples actual ${rate}Hz to exactly 24000 mono samples per second`, () => {
    const { render, sent } = processor(rate);
    for (let position = 0; position < rate; position += 128) {
      const length = Math.min(128, rate - position);
      render([new Float32Array(length).fill(0.75), new Float32Array(length).fill(-0.25)]);
    }
    assert.equal(sent.length, 10);
    for (const chunk of sent) {
      assert.equal(chunk.pcm.byteLength, 4800);
      assert.equal(chunk.pcm.byteLength % 2, 0);
      const view = new DataView(chunk.pcm);
      for (let i = 0; i < view.byteLength; i += 2) assert.equal(view.getInt16(i, true), 8192);
    }
  });
}

test("worklet conversion clips and encodes signed little-endian PCM without NaN", () => {
  const { render, sent } = processor(24000);
  const values = new Float32Array(2400);
  values.set([-2, 2, -1, 1, 0, NaN, Infinity]);
  render([values]);
  const view = new DataView(sent[0].pcm);
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => view.getInt16(i * 2, true)), [-32768, 32767, -32768, 32767, 0, 0, 0]);
  assert.deepEqual([...new Uint8Array(sent[0].pcm).slice(0, 4)], [0, 128, 255, 127]);
});

test("resampling preserves fractional boundary state independently of render-quantum partition", () => {
  function renderSignal(block) {
    const { render, sent } = processor(44100);
    for (let i = 0; i < 44100; i += block) {
      const signal = Float32Array.from({ length: Math.min(block, 44100 - i) }, (_, j) => Math.sin((i + j) * 0.071));
      render([signal]);
    }
    return Buffer.concat(sent.map((chunk) => Buffer.from(chunk.pcm)));
  }
  assert.deepEqual(renderSignal(128), renderSignal(117));
  assert.equal(renderSignal(128).byteLength, 48000);
});

test("worklet mute discards partial samples; stale acknowledgements cannot release current credits", () => {
  const { instance, render, sent, message } = processor(24000);
  render([new Float32Array(1200).fill(1)]);
  message({ type: "capture", enabled: false, generation: 2 });
  render([new Float32Array(2400).fill(1)]);
  assert.equal(sent.length, 0);
  message({ type: "capture", enabled: true, generation: 3 });
  render([new Float32Array(2400).fill(-1)], false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].generation, 3);
  assert.equal(new DataView(sent[0].pcm).getInt16(0, true), -32768);
  message({ type: "ack", generation: 1 });
  assert.equal(instance.inFlight, 1);
  message({ type: "ack", generation: 3 });
  assert.equal(instance.inFlight, 0);
});

test("worklet bounds messages to two unacknowledged chunks and stops processing on teardown", () => {
  const { render, sent, message, instance } = processor(48000);
  for (let i = 0; i < 1000; i++) render([new Float32Array(128)], false);
  assert.equal(sent.length, 2);
  assert.ok(instance.count < 2400);
  message({ type: "ack", generation: 1 });
  for (let i = 0; i < 40; i++) render([new Float32Array(128)], false);
  assert.equal(sent.length, 3);
  message({ type: "stop" });
  assert.equal(render([new Float32Array(128)]), false);
  assert.equal(instance.port.closed, true);
  assert.equal(instance.port.onmessage, null);
  assert.equal(instance.pcm, null);
  assert.equal(instance.view, null);
});
