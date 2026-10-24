export const BREATHING_DURATION_MS = 60_000;
export const INHALE_MS = 4_000;
export const EXHALE_MS = 6_000;
const CYCLE_MS = INHALE_MS + EXHALE_MS;

export type BreathingStatus = "idle" | "running" | "stopped" | "complete";
export type BreathingPhase = "inhale" | "exhale";
export type BreathingState = {
  status: BreathingStatus;
  phase: BreathingPhase;
  remainingSeconds: number;
  phaseSeconds: number;
};

/** A single monotonic clock supplies the text, countdown, and organic guide. No holds. */
export function breathingFrame(elapsedMs: number) {
  const elapsed = Math.min(BREATHING_DURATION_MS, Math.max(0, elapsedMs));
  const cycle = elapsed % CYCLE_MS;
  const phase: BreathingPhase = cycle < INHALE_MS ? "inhale" : "exhale";
  const progress = phase === "inhale" ? cycle / INHALE_MS : (cycle - INHALE_MS) / EXHALE_MS;
  const eased = (1 - Math.cos(Math.PI * progress)) / 2;
  return {
    phase,
    remainingSeconds: Math.ceil((BREATHING_DURATION_MS - elapsed) / 1000),
    phaseSeconds: Math.ceil(((phase === "inhale" ? INHALE_MS : CYCLE_MS) - cycle) / 1000),
    expansion: elapsed === BREATHING_DURATION_MS ? 0 : phase === "inhale" ? eased : 1 - eased,
    complete: elapsed === BREATHING_DURATION_MS,
  };
}

export const initialBreathingState: BreathingState = {
  status: "idle", phase: "inhale", remainingSeconds: 60, phaseSeconds: 4,
};

export function formatBreathingTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Frame = ReturnType<typeof breathingFrame>;
type Clock = { now: () => number; request: (callback: () => void) => number; cancel: (id: number) => void };
const browserClock: Clock = {
  now: () => performance.now(),
  request: callback => requestAnimationFrame(callback),
  cancel: id => cancelAnimationFrame(id),
};

export class BreathingSession {
  private state = initialBreathingState;
  private startedAt = 0;
  private frameId: number | null = null;
  private generation = 0;
  private disposed = false;
  private readonly onState: (state: BreathingState) => void;
  private readonly onFrame: (frame: Frame) => void;
  private readonly clock: Clock;

  constructor(onState: (state: BreathingState) => void, onFrame: (frame: Frame) => void, clock: Clock = browserClock) {
    this.onState = onState; this.onFrame = onFrame; this.clock = clock;
  }

  start() {
    if (this.disposed || this.state.status === "running") return;
    this.cancel();
    this.startedAt = this.clock.now();
    this.state = { ...initialBreathingState, status: "running" };
    this.onState(this.state);
    this.onFrame(breathingFrame(0));
    this.schedule(this.generation);
  }

  stop() {
    if (this.disposed || this.state.status !== "running") return;
    const frame = breathingFrame(this.clock.now() - this.startedAt);
    this.cancel();
    this.onFrame(frame);
    this.state = { status: frame.complete ? "complete" : "stopped", phase: frame.phase, remainingSeconds: frame.remainingSeconds, phaseSeconds: frame.phaseSeconds };
    this.onState(this.state);
  }

  dispose() {
    this.cancel();
    this.disposed = true;
  }

  private cancel() {
    this.generation++;
    if (this.frameId !== null) this.clock.cancel(this.frameId);
    this.frameId = null;
  }

  private schedule(generation: number) {
    this.frameId = this.clock.request(() => {
      if (this.disposed || generation !== this.generation || this.state.status !== "running") return;
      this.frameId = null;
      const frame = breathingFrame(this.clock.now() - this.startedAt);
      this.onFrame(frame);
      const next: BreathingState = { status: frame.complete ? "complete" : "running", phase: frame.phase, remainingSeconds: frame.remainingSeconds, phaseSeconds: frame.phaseSeconds };
      if (next.status !== this.state.status || next.phase !== this.state.phase || next.remainingSeconds !== this.state.remainingSeconds || next.phaseSeconds !== this.state.phaseSeconds) {
        this.state = next;
        this.onState(next);
      }
      if (!frame.complete) this.schedule(generation);
    });
  }
}

/** Scope listeners with the session: hidden tabs never auto-resume. */
export function bindBreathingLifecycle(session: BreathingSession, visibility: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">, page: Pick<Window, "addEventListener" | "removeEventListener">) {
  const stopHidden = () => { if (visibility.visibilityState === "hidden") session.stop(); };
  const stopPage = () => session.stop();
  visibility.addEventListener("visibilitychange", stopHidden);
  page.addEventListener("pagehide", stopPage);
  return () => {
    visibility.removeEventListener("visibilitychange", stopHidden);
    page.removeEventListener("pagehide", stopPage);
    session.dispose();
  };
}
