import assert from "node:assert/strict";
import test from "node:test";
import { VoiceSignal, VOICE_BANDS } from "../lib/voice-signal.ts";

function frame(input = 0.2, output = 0, sampleRate = 48000) {
  return { input: new Float32Array(256).fill(input), output: new Float32Array(256).fill(output), inputFrequency: new Float32Array(128).fill(-Infinity), outputFrequency: new Float32Array(128).fill(-Infinity), sampleRate };
}
function settle(signal, value, steps = 20) {
  for (let i = 1; i <= steps; i++) { signal.receive(value, i * 16); signal.step(i * 16); }
  return [...signal.levels];
}

test("RMS silence gate rejects background, invalid samples and stale spectra", () => {
  const signal = new VoiceSignal();
  for (const amplitude of [0, 0.001, NaN, Infinity]) {
    const value = frame(amplitude); value.inputFrequency.fill(0);
    assert.ok(settle(signal, value).every(level => level === 0));
    signal.reset();
  }
  assert.equal(signal.levels.length, VOICE_BANDS);
});

test("measured frequency distribution uses the actual sample rate without phase cancellation", () => {
  for (const sampleRate of [24000, 44100, 48000, 96000]) {
    const low = frame(0.15, 0, sampleRate); low.inputFrequency[3] = -12;
    const high = frame(0.15, 0, sampleRate); high.inputFrequency[20] = -12;
    assert.notDeepEqual(settle(new VoiceSignal(), low), settle(new VoiceSignal(), high));
  }
  const input = frame(0.2); input.inputFrequency.fill(-20);
  const both = frame(0.2, -0.2); both.inputFrequency.fill(-20); both.outputFrequency.fill(-20);
  assert.deepEqual(settle(new VoiceSignal(), input), settle(new VoiceSignal(), both));
});

test("sensitivity, smoothing, silence threshold and mute affect only measured features", () => {
  const low = settle(new VoiceSignal({ sensitivity: 1 }), frame());
  const high = settle(new VoiceSignal({ sensitivity: 8 }), frame());
  assert.ok(high.every((value, index) => value > low[index]));
  assert.ok(settle(new VoiceSignal({ silenceThreshold: 0.3 }), frame()).every(value => value === 0));
  const fast = settle(new VoiceSignal({ smoothing: { attackMs: 10, releaseMs: 100 } }), frame(), 2);
  const slow = settle(new VoiceSignal({ smoothing: { attackMs: 500, releaseMs: 100 } }), frame(), 2);
  assert.ok(fast.every((value, index) => value > slow[index]));
  const muted = new VoiceSignal(); muted.receive(frame(), 16, true); muted.step(16);
  assert.ok(muted.levels.every(value => value === 0));
  muted.receive(frame(0.2, 0.3), 32, true); muted.step(32);
  assert.ok(muted.levels.some(value => value > 0));
});

test("attack and release are time-based, bounded, stale-safe and resettable", () => {
  const signal = new VoiceSignal(); signal.receive(frame(10, -10), 0);
  signal.step(16); const attack = signal.levels[0]; signal.step(32);
  assert.ok(signal.levels[0] > attack && signal.levels[0] < 1);
  signal.step(200); const release = signal.levels[0]; signal.step(216);
  assert.ok(signal.levels[0] < release && signal.levels[0] > 0);
  for (let now = 232; now <= 4000; now += 16) signal.step(now);
  assert.ok(signal.levels.every(value => value === 0));
  assert.equal(signal.step(4016), false);
  settle(signal, frame()); signal.reset();
  assert.ok(signal.levels.every(value => value === 0));
});
