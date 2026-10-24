export const VOICE_VIEWBOX = "0 0 600 180";

// An authored silhouette, not a time-varying waveform. Three unequal crests with deep saddles.
const CRESTS = [0.1, 0.2, 0.42, 0.7, 0.9, 1, 0.87, 0.58, 0.24, 0.12, 0.32, 0.64, 0.94, 0.79, 0.49, 0.18, 0.12, 0.35, 0.65, 0.91, 0.74, 0.4, 0.12];
const DRIFT = [-2, -4, -1, 3, 5, 2, -2, -5, -3, 0, 3, 5, 1, -3, -5, -1, 3, 5, 2, -2, -4, -1, 2];

type Point = { x: number; y: number };
type Seed = Point & { ivory: boolean };
export type VoiceCellPose = Point & { width: number; height: number; tilt: number; opacity: number };
export type VoiceCell = {
  column: number; row: number; x: number; y: number; width: number; height: number;
  tilt: number; path: string; profile: number; rest: boolean; ivory: boolean; start: VoiceCellPose;
};

// A softly shouldered, slightly asymmetric cushion. This is a clipping domain only:
// no enclosing path, stroke, tube or background is rendered.
const CUSHION: Point[] = Array.from({ length: 64 }, (_, index) => {
  const angle = index / 64 * Math.PI * 2;
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    x: 300 + 136 * Math.sign(c) * Math.abs(c) ** 0.64,
    y: 90 + 74 * Math.sign(s) * Math.abs(s) ** 0.7 + c * 7 + Math.sin(angle * 3) * 2,
  };
});

function clip(polygon: Point[], nx: number, ny: number, limit: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = a.x * nx + a.y * ny - limit, db = b.x * nx + b.y * ny - limit;
    if (da <= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

const distance = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Authored ivory capsule, U-shaped cradle, stem and foot; blue seeds preserve the gaps. */
function microphoneSeeds(): Seed[] {
  const seeds: Seed[] = [];
  const add = (x: number, y: number, ivory = true) => seeds.push({ x, y, ivory });
  for (const y of [59, 72, 85]) { add(293, y); add(307, y + 1); }
  add(300, 95);
  for (const y of [89, 101, 111]) { add(271, y); add(329, y + 1); }
  for (const x of [285, 300, 315]) add(x, 118);
  add(300, 130);
  // Paired sites give the glyph a readable contour without painting an icon over the mosaic.
  for (const y of [58, 72, 86]) { add(277, y, false); add(323, y, false); }
  for (const x of [291, 308]) add(x, 42, false);
  for (const x of [285, 315]) add(x, 49, false);
  for (const x of [283, 317]) { add(x, 96, false); add(x, 107, false); }
  add(300, 106, false);
  for (const x of [282, 318]) add(x, 132, false);
  return seeds;
}

/** Dependency-free Voronoi packing, calculated only when the column count changes. */
function startCells(total: number): { start: VoiceCellPose; path: string; ivory: boolean }[] {
  const seeds = microphoneSeeds();
  const candidates: { point: Point; nearest: number }[] = [];
  for (let row = 0; row < 23; row++) for (let column = 0; column < 64; column++) {
    const identity = row * 64 + column;
    const point = { x: 108 + column * 6.1 + (row % 2) * 3 + (identity * 13 % 7) * 0.37, y: 21 + row * 6.2 + (identity * 17 % 11) * 0.21 };
    const inside = CUSHION.every((a, i) => {
      const b = CUSHION[(i + 1) % CUSHION.length];
      return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= 0;
    });
    if (inside) candidates.push({ point, nearest: Math.min(...seeds.map(seed => distance(point, seed))) });
  }
  while (seeds.length < total) {
    const next = candidates.reduce((best, candidate) => candidate.nearest > best.nearest ? candidate : best);
    seeds.push({ ...next.point, ivory: false });
    for (const candidate of candidates) candidate.nearest = Math.min(candidate.nearest, distance(candidate.point, next.point));
  }
  // Left-to-right correspondence avoids cells flying across the whole object during the morph.
  seeds.sort((a, b) => a.x - b.x || a.y - b.y);
  return seeds.map(seed => {
    let polygon = CUSHION;
    for (const other of seeds) {
      if (seed === other) continue;
      const nx = other.x - seed.x, ny = other.y - seed.y;
      // Shared bisectors inset by 0.48 on either side leave fine, consistent seams.
      polygon = clip(polygon, nx, ny, (other.x ** 2 + other.y ** 2 - seed.x ** 2 - seed.y ** 2) / 2 - Math.hypot(nx, ny) * 0.48);
    }
    const xs = polygon.map(point => point.x), ys = polygon.map(point => point.y);
    const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
    const x = (Math.max(...xs) + Math.min(...xs)) / 2, y = (Math.max(...ys) + Math.min(...ys)) / 2;
    const points = polygon.map(point => ({ x: (point.x - x) * 2 / width, y: (point.y - y) * 2 / height }));
    const blend = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const format = (point: Point) => `${point.x.toFixed(4)} ${point.y.toFixed(4)}`;
    let path = "";
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i + points.length - 1) % points.length], point = points[i], next = points[(i + 1) % points.length];
      // Midpoint splines stay inside each packed region and meet with continuous tangents.
      // There are no straight sides or clipped polygon corners on the visible pebble.
      const entry = blend(point, prev, 0.5), exit = blend(point, next, 0.5);
      path += `${i === 0 ? `M ${format(entry)}` : ""} C ${format(blend(entry, point, 2 / 3))} ${format(blend(exit, point, 2 / 3))} ${format(exit)}`;
    }
    return { start: { x, y, width: width * 0.94, height: height * 0.94, tilt: 0, opacity: 1 }, path: `${path} Z`, ivory: seed.ivory };
  });
}

function interpolate(values: readonly number[], column: number, count: number): number {
  const position = column / (count - 1) * (values.length - 1);
  const lower = Math.floor(position);
  return values[lower] + (values[Math.min(lower + 1, values.length - 1)] - values[lower]) * (position - lower);
}

/** Fixed irregular packing. Size variation is authored from cell identity, never sampled randomly. */
export function createVoiceCells(count: number, spacing: number): VoiceCell[] {
  const cells: VoiceCell[] = [];
  const mosaic = startCells(count * 7);
  const pitch = 500 / (count - 1) * spacing;
  for (let column = 0; column < count; column++) {
    const profile = interpolate(CRESTS, column, count);
    const heights = Array.from({ length: 7 }, (_, row) => (17 + (column * 3 + row * 5) % 10) * (row === 0 || row === 6 ? 0.8 : 1));
    const packing = (132 + (column * 7) % 9) / heights.reduce((sum, height) => sum + height, 0);
    for (let row = 0; row < 7; row++) heights[row] *= packing;
    const ys = new Array<number>(7);
    ys[3] = 90 + interpolate(DRIFT, column, count);
    const gutter = 2.8 * spacing;
    for (let row = 2; row >= 0; row--) ys[row] = ys[row + 1] - heights[row + 1] / 2 - gutter - heights[row] / 2;
    for (let row = 4; row < 7; row++) ys[row] = ys[row - 1] + heights[row - 1] / 2 + gutter + heights[row] / 2;
    for (let row = 0; row < 7; row++) {
      const identity = column * 7 + row;
      cells.push({
        column, row, profile, ...mosaic[identity],
        x: 300 + (column - (count - 1) / 2) * pitch + ((identity * 3) % 5 - 2) * 0.35,
        y: ys[row],
        width: Math.min(pitch - 4, 23) * (0.76 + (identity * 7 % 11) * 0.024) * (row === 0 || row === 6 ? 0.88 : 1),
        height: heights[row], tilt: ((identity * 5) % 9 - 4) * 1.5,
        rest: row === 3 && Math.abs(column - Math.floor(count / 2)) <= 4 && (column - Math.floor(count / 2)) % 2 === 0,
      });
    }
  }
  return cells;
}
