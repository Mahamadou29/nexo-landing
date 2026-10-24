import assert from "node:assert/strict";
import test from "node:test";
import { attachVideoAmbience } from "../lib/video-ambience.ts";

for (const nativeFrames of [true, false]) {
  test(`ambience paints actual frames, throttles and cleans up (${nativeFrames ? "video frames" : "RAF fallback"})`, () => {
    const saved = new Map(["document", "matchMedia", "performance", "requestAnimationFrame", "cancelAnimationFrame"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const doc = Object.assign(new EventTarget(), { hidden: false });
    const motion = Object.assign(new EventTarget(), { matches: false });
    const callbacks = new Map();
    let now = 0, serial = 0, draws = 0, clears = 0;
    const alphas = [];
    const request = callback => { callbacks.set(++serial, callback); return serial; };
    const cancel = id => callbacks.delete(id);
    const video = Object.assign(new EventTarget(), { readyState: 2, paused: false, ended: false });
    if (nativeFrames) Object.assign(video, { requestVideoFrameCallback: request, cancelVideoFrameCallback: cancel });
    const canvas = { width: 64, height: 36, dataset: {}, getContext: () => ({ drawImage(media, x, y, w, h) { assert.equal(media, video); assert.deepEqual([x, y, w, h], [0, 0, 64, 36]); alphas.push(this.globalAlpha); draws++; }, clearRect() { clears++; } }) };
    const tick = time => { now = time; const [id, callback] = callbacks.entries().next().value; callbacks.delete(id); callback(); };
    let dispose;
    try {
      for (const [key, value] of Object.entries({ document: doc, matchMedia: () => motion, performance: { now: () => now }, requestAnimationFrame: request, cancelAnimationFrame: cancel })) Object.defineProperty(globalThis, key, { configurable: true, value });
      dispose = attachVideoAmbience(video, canvas);
      assert.equal(draws, 1); assert.equal(canvas.dataset.ready, "true");
      tick(100); assert.equal(draws, 1);
      tick(125); assert.equal(draws, 2);
      assert.deepEqual(alphas, [1, 0.28], "blend subsequent frames to soften scene changes");
      video.paused = true; video.dispatchEvent(new Event("pause"));
      assert.equal(callbacks.size, 0);
      video.paused = false; video.dispatchEvent(new Event("playing"));
      assert.equal(callbacks.size, 1);
      doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
      assert.equal(callbacks.size, 0);
      const hiddenDraws = draws;
      video.dispatchEvent(new Event("seeked")); assert.equal(draws, hiddenDraws);
      doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
      motion.matches = true; motion.dispatchEvent(new Event("change"));
      assert.equal(callbacks.size, 0);
      motion.matches = false; motion.dispatchEvent(new Event("change"));
      assert.equal(callbacks.size, 1);
      dispose(); dispose = undefined;
      assert.equal(callbacks.size, 0); assert.equal(clears, 1); assert.equal(canvas.dataset.ready, undefined);
      const finalDraws = draws;
      video.dispatchEvent(new Event("playing")); doc.dispatchEvent(new Event("visibilitychange"));
      assert.equal(draws, finalDraws); assert.equal(callbacks.size, 0);
    } finally {
      dispose?.();
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
  });
}

test("missing canvas support leaves video playback alone", () => {
  const cleanup = attachVideoAmbience({}, { getContext: () => null });
  cleanup();
});
