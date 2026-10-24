import assert from "node:assert/strict";
import test from "node:test";
import { bindEntrancePlayback, entranceLetterFlight, entranceLetterPositions, entranceOffscreenX, entranceTiming, evaporationPores } from "../lib/entrance-motion.ts";

import { entranceEntries, letterFamilies, supportsLetterFlight } from "../lib/entrance-copy.ts";

function visibilitySource(hidden = false) {
  const listeners = new Set();
  return {
    hidden,
    listeners,
    addEventListener(type, callback) { assert.equal(type, "visibilitychange"); listeners.add(callback); },
    removeEventListener(type, callback) { assert.equal(type, "visibilitychange"); listeners.delete(callback); },
    change(value) { this.hidden = value; listeners.forEach(callback => callback()); },
  };
}

test("zoom retains independent ×8–×11 flights; other variants never become giant zooms", () => {
  const cue = { variant: "zoom", reverse: false };
  const flights = Array.from({ length: 7 }, (_, i) => entranceLetterFlight(i, 7, cue));
  assert.equal(new Set(flights.map(flight => flight.at)).size, 7);
  assert.deepEqual([...new Set(flights.map(flight => flight.scale))], [8, 9.5, 11]);
  assert.ok(new Set(flights.map(flight => flight.rotation)).size > 1);
  assert.ok(new Set(flights.map(flight => flight.focusX)).size > 1);
  for (let i = 0; i < 7; i++) {
    const reversed = entranceLetterFlight(i, 7, { ...cue, reverse: true });
    assert.equal(reversed.at, flights[6 - i].at);
    assert.equal(reversed.enterAt, flights[6 - i].enterAt);
    for (const variant of ["lateral", "fold", "evaporate"]) {
      assert.equal(entranceLetterFlight(i, 7, { ...cue, variant }).scale, 1);
    }
  }
});

test("dispersal fans in both directions at varied heights; folding alternates axes", () => {
  const flights = Array.from({ length: 10 }, (_, i) => entranceLetterFlight(i, 10, { variant: "lateral", reverse: false }));
  assert.equal(new Set(flights.map(flight => flight.direction)).size, 2);
  assert.equal(new Set(flights.map(flight => flight.arcY)).size, 6);
  assert.equal(new Set(flights.map(flight => flight.exitY)).size, 6);
  assert.deepEqual(flights.slice(0, 4).map(flight => flight.foldVertical), [true, false, true, false]);
});

test("solid exits finish beyond the frame even with giant rotated glyph bounds", () => {
  for (const scale of [1, 8, 9.5, 11]) {
    for (const [width, height] of [[30, 250], [280, 250], [400, 400]]) {
      const radius = Math.hypot(width, height) * scale / 2;
      assert.ok(entranceOffscreenX(width, height, scale, 1) - radius > 1200);
      assert.ok(entranceOffscreenX(width, height, scale, -1) + radius < 0);
    }
  }
});

test("font advances center the phrase and preserve spaces without animating them", () => {
  const advances = [110, 70, 45, 90];
  const positions = entranceLetterPositions(advances);
  assert.deepEqual(positions, [442.5, 552.5, 622.5, 667.5]);
  assert.equal((positions[0] + positions.at(-1) + advances.at(-1)) / 2, 600);
  assert.deepEqual(entranceLetterPositions([]), []);
});

test("expanded FR/EN letters enter, hold, and clear inside each 14-second scene", () => {
  const t = entranceTiming;
  for (const entries of Object.values(entranceEntries)) {
    for (const entry of entries.filter(supportsLetterFlight)) {
      for (const variant of letterFamilies) {
        for (const reverse of [false, true]) {
          const cue = { variant, reverse };
          const count = Array.from(entry.before).filter(character => character !== " ").length;
          const flights = Array.from({ length: count }, (_, i) => entranceLetterFlight(i, count, cue));
          const assembledAt = Math.max(...flights.map(flight => flight.enterAt + flight.enterDuration));
          assert.ok(assembledAt + 0.4 < Math.min(...flights.map(flight => flight.at)));
          for (const flight of flights) {
            assert.ok(flight.enterAt >= 0);
            assert.equal(flight.endAt, flight.at + flight.duration);
            assert.ok(flight.endAt < t.clearAt, entry.before + " / " + variant);
            if (variant === "evaporate") {
              const erosionEnd = flight.at + t.evaporationDelay + t.evaporationDuration + (evaporationPores.length - 1) * t.poreStagger;
              assert.ok(Math.abs(erosionEnd - flight.endAt) < 1e-10);
            }
          }
        }
      }
    }
  }
  assert.equal(t.passage, 14);
  assert.equal(t.passage - t.clearAt, 2);
});

test("evaporation pores cover the entire glyph, not just a partial final dissolve", () => {
  assert.equal(evaporationPores.length, 9);
  assert.ok(evaporationPores.every(pore => Object.values(pore).every(Number.isFinite) && pore.rx > 0 && pore.ry > 0));
  // Sample the entire object bounding box, including all four corners and edges.
  for (let x = 0; x <= 40; x++) {
    for (let y = 0; y <= 40; y++) {
      assert.ok(evaporationPores.some(pore => ((x / 40 - pore.cx) / pore.rx) ** 2 + ((y / 40 - pore.cy) / pore.ry) ** 2 <= 1));
    }
  }
});

test("hidden documents start paused and resume without advancing their timeline", () => {
  const source = visibilitySource(true);
  const states = [];
  const playback = bindEntrancePlayback({ paused: value => states.push(value) }, source, false);
  assert.deepEqual(states, [true]);
  source.change(false);
  source.change(true);
  source.change(false);
  assert.deepEqual(states, [true, false, true, false]);
  playback.dispose();
});

test("manual pause survives tab hiding; resume while hidden waits for visibility", () => {
  const source = visibilitySource();
  const states = [];
  const playback = bindEntrancePlayback({ paused: value => states.push(value) }, source, false);
  playback.setPaused(true);
  source.change(true);
  source.change(false);
  assert.equal(states.at(-1), true);
  source.change(true);
  playback.setPaused(false);
  assert.equal(states.at(-1), true);
  source.change(false);
  assert.equal(states.at(-1), false);
  playback.dispose();
});

test("locale/remount cleanup unsubscribes, stops the old timeline, and preserves user pause", () => {
  const source = visibilitySource();
  const oldStates = [];
  const old = bindEntrancePlayback({ paused: value => oldStates.push(value) }, source, true);
  assert.equal(source.listeners.size, 1);
  old.dispose();
  assert.equal(source.listeners.size, 0);
  assert.equal(oldStates.at(-1), true);
  const count = oldStates.length;
  source.change(true);
  old.setPaused(false);
  assert.equal(oldStates.length, count);
  source.change(false);
  const nextStates = [];
  const next = bindEntrancePlayback({ paused: value => nextStates.push(value) }, source, true);
  assert.deepEqual(nextStates, [true]);
  assert.equal(source.listeners.size, 1);
  next.dispose();
});
