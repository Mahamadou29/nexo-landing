export type RevealClock = {
  now: () => number;
  request: (callback: (time: number) => void) => number;
  cancel: (id: number) => void;
};

export type ChatTextReveal = Pick<SmoothChatText, "push" | "finish" | "dispose">;

/** Decouples visible text from irregular provider chunks without changing its content. */
export class SmoothChatText {
  private text = "";
  private ends: number[] = [];
  private shown = 0;
  private emitted = "";
  private credit = 0;
  private speed = 65;
  private previous = 0;
  private frame: number | null = null;
  private deadline: number | null = null;
  private resolve: (() => void) | null = null;
  private disposed = false;
  private readonly segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

  private readonly emit: (text: string) => void;
  private readonly clock: RevealClock | null;
  private immediate: boolean;

  constructor(emit: (text: string) => void, clock: RevealClock | null, immediate = false) {
    this.emit = emit;
    this.clock = clock;
    this.immediate = immediate;
  }

  push(text: string) {
    if (this.disposed) return;
    if (!text.startsWith(this.text)) {
      this.shown = 0;
      this.credit = 0;
    }
    this.text = text;
    const segmentable = this.deadline === null && /[\uD800-\uDBFF]$/.test(text) ? text.slice(0, -1) : text;
    this.ends = Array.from(this.segmenter.segment(segmentable), part => part.index + part.segment.length);
    this.schedule();
  }

  finish(text: string): Promise<void> {
    if (this.disposed) return Promise.resolve();
    return new Promise(resolve => {
      this.resolve = resolve;
      // A long final chunk must not create many seconds of artificial waiting.
      this.deadline = (this.clock?.now() ?? 0) + 1500;
      this.push(text);
    });
  }

  setImmediate(value: boolean) {
    this.immediate = value;
    this.schedule();
  }

  private paint() {
    const visible = this.text.slice(0, this.ends[this.shown - 1] ?? 0);
    if (visible !== this.emitted) {
      this.emitted = visible;
      this.emit(visible);
    }
    if (this.deadline !== null && this.shown === this.ends.length) {
      const resolve = this.resolve;
      this.resolve = null;
      resolve?.();
    }
  }

  private schedule() {
    if (this.disposed) return;
    if (!this.clock || this.immediate) {
      if (this.frame !== null) this.clock?.cancel(this.frame);
      this.frame = null;
      this.shown = this.ends.length;
      this.paint();
      return;
    }
    // Hold the unfinished final grapheme until another arrives or the stream ends.
    const limit = this.deadline === null ? Math.max(0, this.ends.length - 1) : this.ends.length;
    if (this.shown >= limit) { this.paint(); return; }
    if (this.frame === null) {
      this.previous = this.clock.now();
      this.frame = this.clock.request(this.tick);
    }
  }

  private tick = (now: number) => {
    this.frame = null;
    if (this.disposed || !this.clock) return;
    const elapsed = Math.min(50, Math.max(0, now - this.previous));
    const limit = this.deadline === null ? Math.max(0, this.ends.length - 1) : this.ends.length;
    const backlog = Math.max(0, limit - this.shown);
    const targetSpeed = 65 + Math.min(115, backlog * 1.2);
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-elapsed / 120));
    this.credit += this.speed * elapsed / 1000;
    let advance = Math.floor(this.credit);
    this.credit -= advance;
    if (this.deadline !== null) {
      advance = Math.max(advance, now >= this.deadline ? backlog : Math.ceil(backlog * elapsed / Math.max(1, this.deadline - now)));
    }
    this.shown = Math.min(limit, this.shown + advance);
    this.paint();
    this.schedule();
  };

  dispose() {
    this.disposed = true;
    if (this.frame !== null) this.clock?.cancel(this.frame);
    this.frame = null;
    this.resolve?.();
    this.resolve = null;
  }
}

export function createChatTextReveal(emit: (text: string) => void): ChatTextReveal {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return new SmoothChatText(emit, null);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reveal = new SmoothChatText(emit, {
    now: () => performance.now(),
    request: callback => window.requestAnimationFrame(callback),
    cancel: id => window.cancelAnimationFrame(id),
  });
  const update = () => reveal.setImmediate(motion.matches || document.visibilityState === "hidden");
  update();
  motion.addEventListener("change", update);
  document.addEventListener("visibilitychange", update);
  return {
    push: text => reveal.push(text),
    finish: text => reveal.finish(text),
    dispose() {
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      reveal.dispose();
    },
  };
}
