export type EntranceVariant = "zoom" | "lateral" | "fold" | "evaporate";
export type EntranceCue = { reverse: boolean; variant: EntranceVariant };

export const entranceTiming = {
  enterAt: 0.15,
  enterStagger: 0.08,
  enterDuration: 1.65,
  launchAt: 3.1,
  letterStagger: 0.62,
  clearAt: 12,
  evaporationDelay: 0.65,
  evaporationDuration: 2.03,
  poreStagger: 0.065,
} as const;

// Only evaporation scenes use these deterministic, bottom-to-top local pores.
// No shared wipe, paint, noise texture, or animated filter.
export const evaporationPores = Array.from({ length: 9 }, (_, index) => ({
  cx: 0.1 + (index % 3) * 0.4,
  cy: 0.9 - Math.floor(index / 3) * 0.4,
  rx: 0.4 + (index % 2) * 0.07,
  ry: 0.4 + (index % 3) * 0.04,
}));

const exitDurations = { zoom: 2.9, lateral: 2.7, fold: 2.65, evaporate: 3.2 } as const;

export function entranceLetterFlight(index: number, count: number, cue: EntranceCue) {
  const rank = cue.reverse ? count - 1 - index : index;
  const direction = (index % 2 ? -1 : 1) * (cue.reverse ? -1 : 1);
  const duration = exitDurations[cue.variant];
  // Longer additions still clear before the next scene, with a readable hold.
  const stagger = Math.min(entranceTiming.letterStagger, (entranceTiming.clearAt - entranceTiming.launchAt - duration - 0.2) / Math.max(1, count - 1));
  const at = entranceTiming.launchAt + rank * stagger;
  return {
    at,
    duration,
    endAt: at + duration,
    enterAt: entranceTiming.enterAt + rank * entranceTiming.enterStagger,
    enterDuration: entranceTiming.enterDuration,
    direction,
    scale: cue.variant === "zoom" ? 8 + (index % 3) * 1.5 : 1,
    rotation: direction * (9 + index % 4 * 3),
    focusX: 600 + (index % 3 - 1) * 85,
    focusY: 300 + (index % 2 ? -65 : 65),
    // Dispersal is a fan, not a word translated sideways along one line.
    arcY: direction * (65 + index % 3 * 55),
    exitY: direction * (200 + index % 3 * 130),
    foldVertical: index % 2 === 0,
  };
}

// Circumscribed glyph bounds also cover rotation/skew-free zoom and lateral exits.
// The final center is beyond the SVG edge even for a giant, wide glyph.
export function entranceOffscreenX(width: number, height: number, scale: number, direction: number) {
  return 600 + direction * (600 + Math.hypot(width, height) * scale / 2 + 120);
}

// Keep real font advances (including spaces) rather than guessing character widths.
export function entranceLetterPositions(advances: readonly number[]) {
  let cursor = 600 - advances.reduce((sum, width) => sum + width, 0) / 2;
  return advances.map(width => {
    const position = cursor;
    cursor += width;
    return position;
  });
}

type PlaybackTimeline = { paused: (value: boolean) => unknown };
type VisibilitySource = Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;

// Visibility is independent of the user's pause choice: returning never overrides it.
export function bindEntrancePlayback(timeline: PlaybackTimeline, source: VisibilitySource, initiallyPaused: boolean) {
  let userPaused = initiallyPaused;
  let disposed = false;
  const sync = () => { if (!disposed) timeline.paused(userPaused || source.hidden); };
  source.addEventListener("visibilitychange", sync);
  sync();
  return {
    setPaused(value: boolean) { userPaused = value; sync(); },
    dispose() {
      disposed = true;
      source.removeEventListener("visibilitychange", sync);
      timeline.paused(true);
    },
  };
}
