import type { VoiceWaveform } from "./realtime-voice.ts";

export type VoiceSignalSettings = {
  sensitivity?: number;
  silenceThreshold?: number;
  smoothing?: { attackMs: number; releaseMs: number };
};

export const VOICE_BANDS = 12;
const STALE_MS = 180;
const bounded = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

/** RMS and logarithmic frequency bands only. No audio resources or retained sample buffers. */
export class VoiceSignal {
  readonly levels = new Float32Array(VOICE_BANDS);
  private readonly targets = new Float32Array(VOICE_BANDS);
  private readonly sensitivity: number;
  private readonly threshold: number;
  private readonly attack: number;
  private readonly release: number;
  private receivedAt = -Infinity;
  private steppedAt = 0;

  constructor(settings: VoiceSignalSettings = {}) {
    this.sensitivity = bounded(settings.sensitivity ?? 4, 4, 0.1, 20);
    this.threshold = bounded(settings.silenceThreshold ?? 0.008, 0.008, 0, 0.5);
    this.attack = bounded(settings.smoothing?.attackMs ?? 65, 65, 1, 2000);
    this.release = bounded(settings.smoothing?.releaseMs ?? 240, 240, 1, 4000);
  }

  receive(frame: VoiceWaveform, now: number, muted = false): boolean {
    this.targets.fill(0);
    this.receivedAt = now;
    for (const channel of ["input", "output"] as const) {
      if (channel === "input" && muted) continue;
      const samples = frame[channel];
      let sum = 0;
      for (const sample of samples) {
        const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / Math.max(1, samples.length));
      if (rms <= this.threshold) continue;
      const frequency = channel === "input" ? frame.inputFrequency : frame.outputFrequency;
      const sampleRate = bounded(frame.sampleRate, 48000, 8000, 192000);
      const binHz = sampleRate / (frequency.length * 2);
      const ceiling = Math.min(8000, sampleRate / 2);
      for (let band = 0; band < VOICE_BANDS; band++) {
        const low = 80 * (ceiling / 80) ** (band / VOICE_BANDS);
        const high = 80 * (ceiling / 80) ** ((band + 1) / VOICE_BANDS);
        const first = Math.max(1, Math.floor(low / binHz));
        const last = Math.min(frequency.length, Math.max(first + 1, Math.ceil(high / binHz)));
        let power = 0;
        for (let bin = first; bin < last; bin++) {
          const db = frequency[bin];
          if (Number.isFinite(db)) power += 10 ** (Math.min(0, db) / 10);
        }
        const energy = Math.max(0, rms - this.threshold);
        const spectral = Math.sqrt(power / Math.max(1, last - first));
        const level = Math.min(1, this.sensitivity * (0.55 * energy + 0.45 * Math.min(energy * 2, spectral)));
        // Opposite-polarity microphone/playback never cancel each other visually.
        this.targets[band] = Math.max(this.targets[band], level);
      }
    }
    return this.targets.some(level => level > 0);
  }

  /** Time-based attack/release; stale callbacks decay to rest rather than inventing activity. */
  step(now: number): boolean {
    const dt = Math.max(0, Math.min(64, now - this.steppedAt));
    this.steppedAt = now;
    if (now - this.receivedAt > STALE_MS) this.targets.fill(0);
    let moving = false;
    for (let band = 0; band < VOICE_BANDS; band++) {
      const target = this.targets[band];
      const level = this.levels[band];
      const tau = target > level ? this.attack : this.release;
      const next = level + (target - level) * (1 - Math.exp(-dt / tau));
      this.levels[band] = Math.abs(next - target) < 0.001 ? target : next;
      moving ||= this.levels[band] !== 0 || target !== 0;
    }
    return moving;
  }

  reset(now = 0): void {
    this.levels.fill(0);
    this.targets.fill(0);
    this.receivedAt = -Infinity;
    this.steppedAt = now;
  }
}
