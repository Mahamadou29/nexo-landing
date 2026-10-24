import type { MoodExit } from "./mood-flight.ts";

export type Point = { x: number; y: number };
export type Space = { left: number; top: number; right: number; bottom: number };

export function clampPoint(point: Point, space: Space): Point {
  return {
    x: Math.max(space.left, Math.min(space.right, point.x)),
    y: Math.max(space.top, Math.min(space.bottom, point.y)),
  };
}

export function dropDestination(exit: MoodExit, width: number, height: number, space: Space): Point {
  return clampPoint({ x: exit.x + exit.dx * 170 - width / 2, y: exit.y + exit.dy * 170 - height / 2 }, space);
}

export function driftStep(point: Point, velocity: Point, seconds: number, space: Space) {
  const next = { x: point.x + velocity.x * seconds, y: point.y + velocity.y * seconds };
  return {
    point: clampPoint(next, space),
    velocity: {
      x: next.x <= space.left ? Math.abs(velocity.x) : next.x >= space.right ? -Math.abs(velocity.x) : velocity.x,
      y: next.y <= space.top ? Math.abs(velocity.y) : next.y >= space.bottom ? -Math.abs(velocity.y) : velocity.y,
    },
  };
}
