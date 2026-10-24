import assert from "node:assert/strict";
import test from "node:test";
import { chooseMoodExit } from "../lib/mood-flight.ts";
import { clampPoint, driftStep, dropDestination } from "../lib/mood-space.ts";

const space = { left: 16, top: 102, right: 1200, bottom: 740 };
const input = { left: 350, top: 370, width: 700, height: 176 };

test("initial destinations follow all four exit directions, not a slot above the video", () => {
  const top = dropDestination(chooseMoodExit(input, 0), 224, 128, space);
  const right = dropDestination(chooseMoodExit(input, 0.25), 224, 128, space);
  const bottom = dropDestination(chooseMoodExit(input, 0.5), 224, 128, space);
  const left = dropDestination(chooseMoodExit(input, 0.75), 224, 128, space);
  assert.ok(top.y < input.top);
  assert.ok(bottom.y > input.top + input.height);
  assert.ok(left.x < input.left);
  assert.ok(right.x > input.left + input.width);
});

test("free movement covers the viewport in both axes and bounces inside its bounds", () => {
  let point = { x: 400, y: 300 }, velocity = { x: 44, y: 34 };
  let minX = point.x, maxX = point.x, minY = point.y, maxY = point.y;
  for (let i = 0; i < 7200; i++) {
    ({ point, velocity } = driftStep(point, velocity, 1 / 60, space));
    assert.deepEqual(point, clampPoint(point, space));
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  assert.equal(minX, space.left); assert.equal(maxX, space.right);
  assert.equal(minY, space.top); assert.equal(maxY, space.bottom);
});

test("dragging and resizing clamp stamps at any edge", () => {
  assert.deepEqual(clampPoint({ x: -100, y: -100 }, space), { x: 16, y: 102 });
  assert.deepEqual(clampPoint({ x: 3000, y: 3000 }, space), { x: 1200, y: 740 });
  assert.deepEqual(clampPoint({ x: 450, y: 600 }, space), { x: 450, y: 600 });
  assert.deepEqual(clampPoint({ x: 450, y: 600 }, { left: 16, right: 16, top: 102, bottom: 102 }), { x: 16, y: 102 });
});
