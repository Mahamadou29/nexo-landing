import assert from "node:assert/strict";
import test from "node:test";
import { startIntroductionPlayback } from "../lib/video-playback.ts";

test("autoplay first attempts sound", async () => {
  const calls = [];
  const media = { muted: true, async play() { calls.push(this.muted); } };
  assert.equal(await startIntroductionPlayback(media, () => true), "audible");
  assert.deepEqual(calls, [false]);
});

test("blocked sound falls back to muted playback", async () => {
  const calls = [];
  const media = { muted: false, async play() { calls.push(this.muted); if (!this.muted) throw new Error("NotAllowedError"); } };
  assert.equal(await startIntroductionPlayback(media, () => true), "muted");
  assert.deepEqual(calls, [false, true]);
});

test("a browser blocking both attempts leaves an explicit play fallback", async () => {
  let calls = 0;
  const media = { muted: false, async play() { calls++; throw new Error("blocked"); } };
  assert.equal(await startIntroductionPlayback(media, () => true), "blocked");
  assert.equal(calls, 2);
});

test("leaving or changing language cancels late autoplay work", async () => {
  let active = true, reject, calls = 0;
  const media = { muted: false, play() { calls++; return new Promise((_, no) => { reject = no; }); } };
  const pending = startIntroductionPlayback(media, () => active);
  active = false; reject(new Error("interrupted"));
  assert.equal(await pending, "cancelled");
  assert.equal(calls, 1);
  assert.equal(media.muted, false);
  assert.equal(await startIntroductionPlayback(media, () => false), "cancelled");
  assert.equal(calls, 1);
});
