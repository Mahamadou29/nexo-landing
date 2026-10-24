import assert from "node:assert/strict";
import test from "node:test";
import { chooseMoodExit, moodFlightFrames } from "../lib/mood-flight.ts";

const input = { left: 24, top: 250, width: 272, height: 160 };

test("random exits cover both positions on every membrane edge", () => {
  const exits = Array.from({ length: 8 }, (_, index) => chooseMoodExit(input, index / 8));
  assert.deepEqual(exits.map(exit => exit.side), ["top", "top", "right", "right", "bottom", "bottom", "left", "left"]);
  for (const exit of exits) {
    assert.equal(Math.abs(exit.dx) + Math.abs(exit.dy), 1);
    if (exit.dx) assert.equal(exit.x, exit.dx > 0 ? input.left + input.width : input.left);
    else assert.equal(exit.y, exit.dy > 0 ? input.top + input.height : input.top);
  }
  assert.notEqual(exits[0].x, exits[1].x);
  assert.notEqual(exits[2].y, exits[3].y);
  assert.deepEqual(chooseMoodExit(input, 1), exits[7]);
});

for (const width of [320, 375, 1440]) {
  test(`all eight flights stay horizontally visible at ${width}px and settle on the video view`, () => {
    const target = { left: 52, top: 140, width: width < 640 ? 160 : 224, height: 96 };
    for (let index = 0; index < 8; index++) {
      const frames = moodFlightFrames(chooseMoodExit(input, index / 8), target, width);
      assert.equal(frames[0].opacity, 0);
      assert.equal(frames.at(-1).transform, "translate(0, 0) scale(1)");
      for (const frame of frames.slice(0, -1)) {
        const [, tx, , sx] = frame.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+), ([-\d.]+)\)/);
        const center = target.left + target.width / 2 + Number(tx);
        const half = target.width * Number(sx) / 2;
        assert.ok(center - half >= 8 - 1e-8);
        assert.ok(center + half <= width - 8 + 1e-8);
      }
    }
  });
}
