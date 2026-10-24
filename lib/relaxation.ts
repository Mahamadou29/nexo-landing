export const RELAXATION_DURATION_MS = 120_000;
export const RELAXATION_PHRASE_MS = 24_000;

// Original, unattributed copy written for this local experience.
export const relaxationPhrases = {
  fr: [
    "Cet instant n’attend rien de toi.",
    "Un peu d’espace, juste pour être là.",
    "Tu peux avancer avec douceur.",
    "Même un petit pas ouvre un chemin.",
    "Garde un peu de ce calme pour la suite.",
  ],
  en: [
    "This moment asks nothing of you.",
    "A little space, simply to be here.",
    "There is room to move gently.",
    "Even a small step opens a path.",
    "Take a little of this calm with you.",
  ],
} as const;

export function relaxationTime(deadline: number, now: number) {
  const remainingMs = Math.max(0, Math.min(RELAXATION_DURATION_MS, deadline - now));
  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    phrase: Math.min(relaxationPhrases.fr.length - 1, Math.floor((RELAXATION_DURATION_MS - remainingMs) / RELAXATION_PHRASE_MS)),
  };
}

export function formatRelaxationTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export type RelaxationState = {
  status: "idle" | "starting" | "playing" | "stopping" | "stopped" | "complete" | "error";
  remainingSeconds: number;
  phrase: number;
};
export const initialRelaxationState: RelaxationState = { status: "idle", remainingSeconds: 120, phrase: 0 };

type Timer = ReturnType<typeof setTimeout>;
type Dependencies = {
  now: () => number;
  createContext: () => AudioContext;
  setTimer: (callback: () => void, delay: number) => Timer;
  clearTimer: (timer: Timer) => void;
};
const defaults: Dependencies = {
  now: () => performance.now(),
  createContext: () => new AudioContext(),
  setTimer: (callback, delay) => setTimeout(callback, delay),
  clearTimer: timer => clearTimeout(timer),
};

// Shared across remounts: a new gesture cannot overlap a context still closing.
let leasedContext: AudioContext | null = null;
const safely = (action: () => void) => { try { action(); } catch { /* Continue releasing other resources. */ } };

export class RelaxationSession {
  private state: RelaxationState = { ...initialRelaxationState };
  private readonly onState: (state: RelaxationState) => void;
  private readonly deps: Dependencies;
  private context: AudioContext | null = null;
  private envelope: GainNode | null = null;
  private level: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private sources: OscillatorNode[] = [];
  private timer: Timer | null = null;
  private deadline = 0;
  private attempt = 0;
  private volume = 20;
  private disposed = false;
  private closing: Promise<void> | null = null;
  private releaseFade: (() => void) | null = null;

  constructor(onState: (state: RelaxationState) => void, deps: Partial<Dependencies> = {}) {
    this.onState = onState;
    this.deps = { ...defaults, ...deps };
  }

  private emit(next: Partial<RelaxationState>) {
    const state = { ...this.state, ...next };
    if (state.status === this.state.status && state.remainingSeconds === this.state.remainingSeconds && state.phrase === this.state.phrase) return;
    this.state = state;
    if (!this.disposed) this.onState(state);
  }

  private clearTimer() {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  // Called synchronously inside the start button's gesture, never by an effect.
  async start() {
    if (this.disposed || this.context || this.closing) return;
    const attempt = ++this.attempt;
    this.emit({ ...initialRelaxationState, status: "starting" });
    try {
      if (leasedContext && leasedContext.state !== "closed") throw new Error("audio-busy");
      const context = this.deps.createContext();
      leasedContext = context;
      this.context = context;
      this.timer = this.deps.setTimer(() => { void this.finish("error", true); }, 10_000);
      await context.resume();
      if (this.disposed || attempt !== this.attempt || this.context !== context) return;
      if (context.state !== "running") throw new Error("audio-unavailable");
      this.clearTimer();
      const begin = context.currentTime;
      const end = begin + RELAXATION_DURATION_MS / 1000;
      const envelope = context.createGain();
      this.nodes.push(envelope); this.envelope = envelope;
      const level = context.createGain();
      this.nodes.push(level); this.level = level;
      level.gain.setValueAtTime(this.volume / 100 * 0.12, begin);
      envelope.gain.setValueAtTime(0, begin);
      envelope.gain.linearRampToValueAtTime(1, begin + 1.2);
      envelope.gain.setValueAtTime(1, end - 1.2);
      envelope.gain.linearRampToValueAtTime(0, end);
      envelope.connect(level); level.connect(context.destination);
      // Two warm sine tones, softly varying in amplitude; no file, mic or network.
      [174, 261].forEach((frequency, index) => {
        const tone = context.createOscillator();
        this.sources.push(tone); this.nodes.push(tone);
        const voice = context.createGain(); this.nodes.push(voice);
        const drift = context.createOscillator();
        this.sources.push(drift); this.nodes.push(drift);
        const depth = context.createGain(); this.nodes.push(depth);
        tone.type = "sine"; tone.frequency.value = frequency;
        voice.gain.value = index === 0 ? 0.45 : 0.3;
        drift.frequency.value = index === 0 ? 0.065 : 0.083;
        depth.gain.value = 0.1;
        drift.connect(depth); depth.connect(voice.gain);
        tone.connect(voice); voice.connect(envelope);
        tone.start(begin); drift.start(begin);
        // Audio-thread hard stop remains effective even when JS timers are delayed.
        tone.stop(end); drift.stop(end);
        tone.onended = () => { if (this.state.status === "playing") void this.finish("complete", true); };
      });
      this.deadline = this.deps.now() + RELAXATION_DURATION_MS;
      context.onstatechange = () => {
        if (this.state.status === "playing" && context.state !== "running") void this.finish("error", true);
      };
      this.emit({ status: "playing" });
      this.tick();
    } catch {
      if (attempt === this.attempt && !this.disposed) await this.finish("error", true);
    }
  }

  private tick = () => {
    this.clearTimer();
    if (this.state.status !== "playing") return;
    const next = relaxationTime(this.deadline, this.deps.now());
    this.emit(next);
    if (next.remainingSeconds === 0) { void this.finish("complete", true); return; }
    this.timer = this.deps.setTimer(this.tick, Math.min(250, Math.max(1, this.deadline - this.deps.now())));
  };

  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(100, value));
    if (this.level && this.context && this.state.status === "playing") {
      try { this.level.gain.setTargetAtTime(this.volume / 100 * 0.12, this.context.currentTime, 0.15); }
      catch { void this.finish("error", true); }
    }
  }

  stop(immediate = false) {
    if (!["starting", "playing", "stopping"].includes(this.state.status)) return Promise.resolve();
    return this.finish("stopped", immediate);
  }

  private finish(status: "stopped" | "complete" | "error", immediate: boolean): Promise<void> {
    ++this.attempt;
    if (this.closing) {
      // Hidden/unmount during a manual fade must silence immediately as well.
      if (immediate) { this.silence(); this.clearTimer(); this.releaseFade?.(); }
      return this.closing;
    }
    this.clearTimer();
    const context = this.context;
    if (!context) { this.emit({ status }); return Promise.resolve(); }
    context.onstatechange = null;
    this.sources.forEach(source => { source.onended = null; });
    if (status === "complete") this.emit({ ...relaxationTime(this.deadline, this.deadline), status: "stopping" });
    else this.emit({ status: "stopping" });
    const fade = !immediate && context.state === "running" && this.envelope;
    if (fade) {
      safely(() => {
        const gain = this.envelope!.gain;
        gain.cancelAndHoldAtTime(context.currentTime);
        gain.linearRampToValueAtTime(0, context.currentTime + 0.18);
      });
    } else this.silence();
    // Keep the lease until close resolves; rejecting close never permits overlap.
    this.closing = (async () => {
      if (fade) await new Promise<void>(resolve => { this.releaseFade = resolve; this.timer = this.deps.setTimer(resolve, 200); });
      this.releaseFade = null;
      this.timer = null;
      this.silence();
      this.sources.forEach(source => safely(() => source.stop()));
      this.nodes.forEach(node => safely(() => node.disconnect()));
      this.sources = []; this.nodes = []; this.envelope = null; this.level = null;
      let result = status;
      try { if (context.state !== "closed") await context.close(); }
      catch { result = "error"; }
      if (context.state === "closed" && leasedContext === context) leasedContext = null;
      this.context = null;
      this.emit({ status: result });
    })().finally(() => { this.closing = null; });
    return this.closing;
  }

  private silence() {
    if (this.envelope && this.context) safely(() => {
      this.envelope!.gain.cancelScheduledValues(this.context!.currentTime);
      this.envelope!.gain.setValueAtTime(0, this.context!.currentTime);
      this.envelope!.disconnect();
    });
  }

  dispose() {
    this.disposed = true;
    return this.stop(true);
  }
}
