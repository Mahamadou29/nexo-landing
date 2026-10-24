import assert from "node:assert/strict";
import test from "node:test";
import { createVoiceCells, VOICE_VIEWBOX } from "../lib/voice-cell-geometry.ts";

test("authored organic envelope has exactly three unequal crests and deep saddles", () => {
  const cells = createVoiceCells(23, 1);
  const profiles = cells.filter(cell => cell.row === 3).map(cell => cell.profile);
  const peaks = profiles.flatMap((value, index) => index > 0 && index < profiles.length - 1 && value > profiles[index - 1] && value > profiles[index + 1] ? [index] : []);
  assert.deepEqual(peaks, [5, 12, 19]);
  assert.equal(new Set(peaks.map(index => profiles[index])).size, 3);
  assert.ok(profiles[9] < 0.2 && profiles[16] < 0.2);
  assert.equal(VOICE_VIEWBOX, "0 0 600 180");
});

test("fitted pebbles have stable asymmetric paths and irregular active vertical packing", () => {
  const cells = createVoiceCells(23, 1);
  assert.deepEqual(cells, createVoiceCells(23, 1));
  assert.ok(new Set(cells.map(cell => cell.path)).size > cells.length * 0.95, "fitted contours, not six repeated circles");
  assert.ok(cells.every(cell => cell.path.includes(" C ") && cell.path.endsWith(" Z")));
  assert.ok(new Set(cells.map(cell => cell.width.toFixed(2))).size > 6);
  assert.ok(new Set(cells.map(cell => cell.height.toFixed(2))).size > 30);
  assert.ok(cells.some(cell => cell.height / cell.width > 1.2));
  assert.ok(cells.some(cell => cell.height / cell.width < 0.95), "some pebbles are wider than they are tall");
  assert.ok(new Set(cells.filter(cell => cell.row === 3).map(cell => cell.y)).size > 5, "no straight equalizer baseline");
  for (let column = 0; column < 23; column++) {
    const stack = cells.filter(cell => cell.column === column);
    for (let row = 1; row < 7; row++) {
      const separation = stack[row].y - stack[row].height / 2 - stack[row - 1].y - stack[row - 1].height / 2;
      assert.ok(Math.abs(separation - 2.8) < 0.0001, "variable heights are packed with real gaps");
    }
  }
});

test("resting cushion stays cohesive and centered with airy cells and a clear ivory microphone", () => {
  for (const count of [19, 23, 27]) {
    const cells = createVoiceCells(count, 1);
    assert.equal(cells.filter(cell => cell.start.opacity === 1).length, count * 7);
    const ivory = cells.filter(cell => cell.ivory);
    assert.equal(ivory.length, 17);
    assert.ok(ivory.filter(cell => cell.start.y < 100 && Math.abs(cell.start.x - 300) < 18).length >= 7, "capsule");
    assert.ok(ivory.some(cell => cell.start.x < 277 && cell.start.y > 88), "left cradle");
    assert.ok(ivory.some(cell => cell.start.x > 323 && cell.start.y > 88), "right cradle");
    assert.ok(ivory.some(cell => Math.abs(cell.start.x - 300) < 7 && cell.start.y > 127), "stem");
    assert.ok(cells.some(cell => !cell.ivory && Math.abs(cell.start.x - 300) < 7 && cell.start.y > 101 && cell.start.y < 111), "blue negative space separates capsule and cradle");
    for (const { start, path } of cells) {
      assert.ok(start.width > 3 && start.height > 3 && start.width < 40 && start.height < 40);
      assert.ok(start.x - start.width / 2 >= 163 && start.x + start.width / 2 <= 437);
      assert.ok(start.y - start.height / 2 >= 10 && start.y + start.height / 2 <= 170);
      assert.equal(start.tilt, 0, "no rotation that would tear the shared seams apart");
      assert.doesNotMatch(path, /NaN|Infinity/);
    }
    const left = Math.min(...cells.map(cell => cell.start.x - cell.start.width / 2));
    const right = Math.max(...cells.map(cell => cell.start.x + cell.start.width / 2));
    assert.ok(Math.abs((left + right) / 2 - 300) < 1);
    // Adjacent rounded Voronoi cells share inset bisectors rather than independently placed dots.
    const boxArea = cells.reduce((area, cell) => area + cell.start.width * cell.start.height, 0);
    assert.ok(boxArea > 270 * 145 * 0.85, "dense mosaic covers the cushion instead of sparse anchors");
  }
});

test("pebbles have continuous curved surfaces, without straight mosaic edges or corner seams", () => {
  for (const { path } of createVoiceCells(23, 1)) {
    assert.doesNotMatch(path, /[LQHV]/);
    const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const first = values.slice(0, 2);
    const arcs = [];
    for (let i = 2; i < values.length; i += 6) arcs.push(values.slice(i, i + 6));
    assert.ok(arcs.length >= 3);
    assert.deepEqual(arcs.at(-1).slice(4), first, "closed without a straight closing segment");
    arcs.forEach((arc, index) => {
      const next = arcs[(index + 1) % arcs.length];
      for (let axis = 0; axis < 2; axis++) {
        const arriving = arc[axis + 4] - arc[axis + 2];
        const leaving = next[axis] - arc[axis + 4];
        assert.ok(Math.abs(arriving - leaving) < 0.0003, "tangent-continuous inflated contour");
      }
    });
  }
});

test("all supported columns and spacing retain fixed identities, five active-silence cells and safe bounds", () => {
  for (const count of [19, 23, 27]) for (const spacing of [0.8, 1, 1.12]) {
    const cells = createVoiceCells(count, spacing);
    assert.equal(cells.length, count * 7);
    assert.equal(cells.filter(cell => cell.rest).length, 5);
    assert.ok(cells.every(cell => cell.width > 0 && cell.height > 0));
    for (const cell of cells) {
      // Conservative rotated bounds, including the maximum small energy-driven deformation.
      const angle = Math.abs(cell.tilt) * Math.PI / 180;
      const rx = (cell.width * 1.09 * Math.cos(angle) + cell.height * 1.05 * Math.sin(angle)) / 2;
      const ry = (cell.height * 1.05 * Math.cos(angle) + cell.width * 1.09 * Math.sin(angle)) / 2;
      assert.ok(cell.x - rx >= 0 && cell.x + rx <= 600);
      assert.ok(cell.y - ry >= 0 && cell.y + ry <= 180);
    }
  }
});
