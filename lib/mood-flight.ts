export type MoodExit = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  side: "top" | "right" | "bottom" | "left";
  position: "start" | "end";
};

type Bounds = { left: number; top: number; width: number; height: number };

export function chooseMoodExit(bounds: Bounds, random: number): MoodExit {
  const index = Math.min(7, Math.max(0, Math.floor(random * 8)));
  const side = (["top", "right", "bottom", "left"] as const)[Math.floor(index / 2)];
  const position = index % 2 === 0 ? "start" : "end";
  const ratio = position === "start" ? 0.32 : 0.68;
  const dx = side === "right" ? 1 : side === "left" ? -1 : 0;
  const dy = side === "bottom" ? 1 : side === "top" ? -1 : 0;
  return {
    side, position, dx, dy,
    x: bounds.left + bounds.width * (dx ? (dx + 1) / 2 : ratio),
    y: bounds.top + bounds.height * (dy ? (dy + 1) / 2 : ratio),
  };
}

export function moodFlightFrames(exit: MoodExit, target: Bounds, viewportWidth: number) {
  const transform = (x: number, y: number, sx: number, sy: number) => {
    const margin = target.width * sx / 2 + 8;
    const safeX = Math.max(margin, Math.min(viewportWidth - margin, x));
    return `translate(${safeX - target.left - target.width / 2}px, ${y - target.top - target.height / 2}px) scale(${sx}, ${sy})`;
  };
  return [
    { offset: 0, opacity: 0, transform: transform(exit.x - exit.dx * 16, exit.y - exit.dy * 16, 0.25, 0.25) },
    { offset: 0.2, opacity: 0.7, transform: transform(exit.x, exit.y, exit.dx ? 0.65 : 0.24, exit.dx ? 0.24 : 0.65) },
    { offset: 0.45, opacity: 1, transform: transform(exit.x + exit.dx * 42, exit.y + exit.dy * 42, 0.8, 1.05) },
    { offset: 1, opacity: 1, transform: "translate(0, 0) scale(1)" },
  ];
}
