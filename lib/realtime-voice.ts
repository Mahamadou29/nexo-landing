export type VoiceState = {
  status: "idle" | "connecting" | "listening" | "speaking" | "ended" | "error";
  muted: boolean;
  remainingSeconds: number;
  error?: "unavailable" | "connection" | "protocol" | "limit" | "rate_limited" | "busy" | "microphone" | "unsupported" | "timeout";
  reason?: "time_limit" | "stopped";
};

export type VoiceWaveform = {
  input: Float32Array;
  output: Float32Array;
  /** dB spectra (silence = -Infinity), FFT size 256, sampleRate from the session context. */
  inputFrequency: Float32Array;
  outputFrequency: Float32Array;
  sampleRate: number;
};

export type RealtimeVoiceOptions = {
  locale: "fr" | "en";
  consent: boolean;
  apiBase: string;
  onState: (state: VoiceState) => void;
  /** Borrowed samples, refreshed in place on each frame; never persisted or transmitted. */
  onWaveform?: (waveform: VoiceWaveform) => void;
};

type Item = { id: string; played: number; done: boolean };
type Playback = { item: Item; start: number; end: number; node: AudioBufferSourceNode };
const RATE = 24_000;
const MAX_SECONDS = 120;
const MAX_SOCKET_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 132_000;
// Replies can arrive faster than they play; bound memory by the session budget, not network pace.
const MAX_QUEUE_SECONDS = MAX_SECONDS;
const MAX_PLAYBACK_NODES = 4096;

function socketUrl(base: string): string {
  const url = new URL(base.trim() || "http://127.0.0.1:8787");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid API base");
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/v1/landing/demo/realtime";
  return url.href;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function itemId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}
function safely(action: () => void) {
  try { action(); } catch { /* Cleanup must continue even after a browser resource has closed. */ }
}

/** One-shot session. Call start directly from a consented user gesture; stop on UI unmount. */
export class RealtimeVoiceSession {
  private readonly options: RealtimeVoiceOptions;
  private state: VoiceState = { status: "idle", muted: false, remainingSeconds: MAX_SECONDS };
  private terminal = false;
  private ready = false;
  private context?: AudioContext;
  private stream?: MediaStream;
  private input?: MediaStreamAudioSourceNode;
  private worklet?: AudioWorkletNode;
  private inputAnalyser?: AnalyserNode;
  private outputAnalyser?: AnalyserNode;
  private waveformTimer?: ReturnType<typeof setInterval>;
  private readonly waveform = {
    input: new Float32Array(256), output: new Float32Array(256),
    inputFrequency: new Float32Array(128).fill(-Infinity),
    outputFrequency: new Float32Array(128).fill(-Infinity), sampleRate: 0,
  };
  private socket?: WebSocket;
  private playback: Playback[] = [];
  private latestItem?: Item;
  private retired = new Set<string>();
  private generation = 0;
  private wallStart = 0;
  private monotonicStart = 0;
  private budgetSeconds = MAX_SECONDS;
  private phaseTimer?: ReturnType<typeof setTimeout>;
  private deadlineTimer?: ReturnType<typeof setTimeout>;
  private tickTimer?: ReturnType<typeof setInterval>;
  private startPromise?: Promise<void>;
  private finishStart?: () => void;
  private readonly onHidden = () => { if (document.visibilityState === "hidden") this.stop(); };
  private readonly onPageHide = () => this.stop();

  constructor(options: RealtimeVoiceOptions) {
    this.options = { ...options };
  }

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    if (this.terminal) return Promise.resolve();
    this.startPromise = new Promise((resolve) => { this.finishStart = resolve; });
    if (!this.options.consent || !["fr", "en"].includes(this.options.locale)) {
      this.fail("protocol");
      return this.startPromise;
    }
    let url: string;
    try { url = socketUrl(this.options.apiBase); }
    catch { this.fail("protocol"); return this.startPromise; }
    if (typeof AudioContext === "undefined" || typeof AudioWorkletNode === "undefined" ||
        typeof WebSocket === "undefined" || !globalThis.navigator?.mediaDevices?.getUserMedia) {
      this.fail("unsupported");
      return this.startPromise;
    }
    this.wallStart = Date.now();
    this.monotonicStart = performance.now();
    let resumed: Promise<void>;
    try {
      this.context = new AudioContext({ latencyHint: "interactive" });
      // Must run on the original click stack, before any permission/network await.
      resumed = this.context.resume();
    } catch {
      this.fail("unsupported");
      return this.startPromise;
    }
    // Install a rejection handler immediately, including when a permission prompt never settles.
    const context = this.context;
    const contextReady = Promise.resolve(resumed).then(() => {
      if (!this.terminal && !context.audioWorklet) this.fail("unsupported");
    }, () => { if (!this.terminal) this.fail("unsupported"); });
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onHidden);
    if (typeof window !== "undefined") window.addEventListener("pagehide", this.onPageHide);
    this.deadlineTimer = setTimeout(() => this.end("time_limit"), MAX_SECONDS * 1000);
    this.tickTimer = setInterval(() => this.tick(), 250);
    this.armPhase(15_000);
    this.publish({ status: "connecting" });
    if (typeof document !== "undefined" && document.visibilityState === "hidden") this.stop();
    if (!this.terminal) void this.prepare(url, contextReady).catch(() => this.fail("unsupported"));
    return this.startPromise;
  }

  stop(): void {
    if (!this.terminal) this.end("stopped");
  }

  setMuted(muted: boolean): void {
    if (this.terminal || this.state.muted === muted) return;
    this.state = { ...this.state, muted };
    for (const track of this.stream?.getTracks() ?? []) track.enabled = !muted;
    this.configureCapture();
    if (this.ready && !this.send({ type: "mute", muted })) return;
    this.publish({});
    this.sampleWaveform();
  }

  private sampleWaveform(): void {
    if (!this.options.onWaveform) return;
    this.waveform.input.fill(0);
    this.waveform.output.fill(0);
    this.waveform.inputFrequency.fill(-Infinity);
    this.waveform.outputFrequency.fill(-Infinity);
    if (this.ready && !this.terminal && this.context?.state === "running") {
      if (!this.state.muted) {
        safely(() => this.inputAnalyser?.getFloatTimeDomainData(this.waveform.input));
        safely(() => this.inputAnalyser?.getFloatFrequencyData(this.waveform.inputFrequency));
      }
      // Scheduled PCM is not a signal. Only sample the output during a playing buffer.
      const time = this.context.currentTime;
      if (this.playback.some(part => part.start <= time && time < part.end)) {
        safely(() => this.outputAnalyser?.getFloatTimeDomainData(this.waveform.output));
        safely(() => this.outputAnalyser?.getFloatFrequencyData(this.waveform.outputFrequency));
      }
    }
    safely(() => this.options.onWaveform?.(this.waveform));
  }

  private publish(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    // Consumer callbacks must not interrupt resource teardown or produce unhandled promises.
    safely(() => this.options.onState({ ...this.state }));
  }

  private armPhase(milliseconds: number): void {
    clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => this.fail("timeout"), milliseconds);
  }

  private elapsed(): number {
    return Math.max(Date.now() - this.wallStart, performance.now() - this.monotonicStart, 0) / 1000;
  }

  private checkDeadline(): boolean {
    if (this.terminal) return false;
    if (this.elapsed() >= this.budgetSeconds) { this.end("time_limit"); return false; }
    return true;
  }

  private async prepare(url: string, contextReady: Promise<void>): Promise<void> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false,
      });
    } catch { if (!this.terminal) this.fail("microphone"); return; }
    if (!this.checkDeadline()) {
      for (const track of stream.getTracks()) safely(() => track.stop());
      return;
    }
    this.stream = stream;
    for (const track of stream.getTracks()) {
      track.enabled = !this.state.muted;
      track.onended = () => this.fail("microphone");
    }
    if (!stream.getAudioTracks().some((track) => track.readyState !== "ended")) { this.fail("microphone"); return; }
    this.armPhase(10_000);
    await contextReady;
    if (!this.checkDeadline()) return;
    const context = this.context!;
    try {
      await context.audioWorklet.addModule("/audio/nexo-pcm-worklet.js");
      if (!this.checkDeadline()) return;
      this.worklet = new AudioWorkletNode(context, "nexo-pcm", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      });
      this.worklet.port.onmessage = (event: MessageEvent<unknown>) => this.capture(event.data);
      this.worklet.onprocessorerror = () => this.fail("unsupported");
      this.input = context.createMediaStreamSource(stream);
      if (this.options.onWaveform) {
        this.inputAnalyser = context.createAnalyser();
        this.outputAnalyser = context.createAnalyser();
        this.inputAnalyser.fftSize = this.outputAnalyser.fftSize = this.waveform.input.length;
        // Envelope smoothing belongs to the visualization analysis, not the audio graph.
        this.inputAnalyser.smoothingTimeConstant = this.outputAnalyser.smoothingTimeConstant = 0;
        this.waveform.sampleRate = context.sampleRate;
        this.input.connect(this.inputAnalyser);
        this.inputAnalyser.connect(this.worklet);
        this.outputAnalyser.connect(context.destination);
      } else {
        this.input.connect(this.worklet);
      }
      // The processor emits silence. Connecting it keeps capture rendering without mic monitoring.
      this.worklet.connect(context.destination);
    } catch { this.fail("unsupported"); return; }
    try {
      const socket = new WebSocket(url);
      this.socket = socket;
      this.armPhase(10_000);
      socket.onopen = () => {
        if (!this.checkDeadline() || this.socket !== socket) { safely(() => socket.close()); return; }
        this.send({ type: "start", locale: this.options.locale, consent: true });
      };
      socket.onmessage = (event: MessageEvent<unknown>) => {
        if (this.socket === socket && this.checkDeadline()) this.receive(event.data);
      };
      socket.onerror = () => { if (this.socket === socket) this.fail("connection"); };
      socket.onclose = () => { if (this.socket === socket) this.fail("connection"); };
    } catch { this.fail("connection"); }
  }

  private configureCapture(): void {
    this.generation++;
    if (this.worklet) {
      try { this.worklet.port.postMessage({ type: "capture", enabled: this.ready && !this.state.muted, generation: this.generation }); }
      catch { this.fail("unsupported"); }
    }
  }

  private capture(value: unknown): void {
    if (!this.checkDeadline() || !record(value)) return;
    if (value.type !== "pcm" || value.generation !== this.generation) return;
    if (this.worklet) {
      try { this.worklet.port.postMessage({ type: "ack", generation: this.generation }); }
      catch { this.fail("unsupported"); return; }
    }
    if (!this.ready || this.state.muted) return;
    if (!(value.pcm instanceof ArrayBuffer) || value.pcm.byteLength === 0 ||
        value.pcm.byteLength > 4800 || value.pcm.byteLength % 2 !== 0) { this.fail("protocol"); return; }
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) { this.fail("connection"); return; }
    if (socket.bufferedAmount + value.pcm.byteLength > MAX_SOCKET_BYTES) { this.fail("limit"); return; }
    try { socket.send(value.pcm); }
    catch { this.fail("connection"); }
  }

  private send(message: Record<string, unknown>): boolean {
    if (!this.checkDeadline()) return false;
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) { this.fail("connection"); return false; }
    const text = JSON.stringify(message);
    if (socket.bufferedAmount + new TextEncoder().encode(text).byteLength > MAX_SOCKET_BYTES) { this.fail("limit"); return false; }
    try { socket.send(text); return true; }
    catch { this.fail("connection"); return false; }
  }

  private receive(data: unknown): void {
    if (typeof data !== "string" || data.length > MAX_MESSAGE_CHARS) { this.fail("protocol"); return; }
    let message: unknown;
    try { message = JSON.parse(data); } catch { this.fail("protocol"); return; }
    if (!record(message) || typeof message.type !== "string") { this.fail("protocol"); return; }
    if (message.type === "error") {
      const code = message.code;
      this.fail(code === "unavailable" || code === "connection" || code === "protocol" || code === "limit" || code === "rate_limited" || code === "busy" ? code : "protocol");
      return;
    }
    if (message.type === "ended") {
      if (message.reason === "time_limit" || message.reason === "stopped") this.end(message.reason);
      else this.fail("protocol");
      return;
    }
    if (message.type === "ready") {
      if (this.ready || !Number.isInteger(message.max_seconds) ||
          typeof message.max_seconds !== "number" || message.max_seconds < 1 || message.max_seconds > MAX_SECONDS) {
        this.fail("protocol"); return;
      }
      this.budgetSeconds = message.max_seconds;
      if (!this.checkDeadline()) return;
      this.ready = true;
      clearTimeout(this.phaseTimer);
      clearTimeout(this.deadlineTimer);
      this.deadlineTimer = setTimeout(() => this.end("time_limit"), (this.budgetSeconds - this.elapsed()) * 1000);
      this.configureCapture();
      if (this.state.muted && !this.send({ type: "mute", muted: true })) return;
      if (this.terminal) return;
      this.publish({ status: "listening", remainingSeconds: Math.ceil(this.budgetSeconds - this.elapsed()) });
      if (this.options.onWaveform && !this.terminal) {
        this.waveformTimer = setInterval(() => this.sampleWaveform(), 1000 / 30);
        this.sampleWaveform();
      }
      this.finishStart?.();
      this.finishStart = undefined;
      return;
    }
    if (!this.ready) { this.fail("protocol"); return; }
    switch (message.type) {
      case "audio": this.play(message.audio, message.item_id); break;
      case "speech_started": this.interrupt(); break;
      case "speech_stopped": this.tick(); break;
      case "audio_done": {
        if (!itemId(message.item_id)) { this.fail("protocol"); return; }
        const item = message.item_id === this.latestItem?.id
          ? this.latestItem : this.playback.find((part) => part.item.id === message.item_id)?.item;
        if (item) item.done = true;
        this.tick();
        break;
      }
      default: this.fail("protocol");
    }
  }

  /** Output position, not scheduled buffer duration. Fallback subtracts device/render latency. */
  private audibleTime(): number {
    const context = this.context!;
    if (typeof context.getOutputTimestamp === "function") {
      const timestamp = context.getOutputTimestamp();
      if (Number.isFinite(timestamp.contextTime) && Number.isFinite(timestamp.performanceTime) && timestamp.performanceTime! > 0) {
        const advance = context.state === "running" ? Math.max(0, performance.now() - timestamp.performanceTime!) / 1000 : 0;
        return Math.max(0, Math.min(context.currentTime, timestamp.contextTime! + advance));
      }
    }
    const latency = Math.max(0, context.baseLatency || 0) + Math.max(0, context.outputLatency || 0);
    return Math.max(0, context.currentTime - latency);
  }

  private prunePlayback(): void {
    const time = this.audibleTime();
    while (this.playback.length && this.playback[0].end <= time) {
      const part = this.playback.shift()!;
      part.item.played += part.end - part.start;
      safely(() => part.node.disconnect());
    }
  }

  private play(encoded: unknown, id: unknown): void {
    if (!itemId(id) || typeof encoded !== "string" || !encoded.length || encoded.length > 128_000 ||
        encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      this.fail("protocol"); return;
    }
    let binary: string;
    try { binary = atob(encoded); } catch { this.fail("protocol"); return; }
    if (binary.length % 2 !== 0 || btoa(binary) !== encoded) { this.fail("protocol"); return; }
    if (this.retired.has(id)) return; // In-flight audio arriving after barge-in must never restart playback.
    this.prunePlayback();
    const context = this.context!;
    const start = Math.max(context.currentTime + 0.015, this.playback.at(-1)?.end ?? 0);
    const duration = binary.length / 2 / RATE;
    if (start + duration - this.audibleTime() > MAX_QUEUE_SECONDS || this.playback.length >= MAX_PLAYBACK_NODES) {
      this.fail("limit"); return;
    }
    let item = this.playback.find((part) => part.item.id === id)?.item;
    if (!item && this.latestItem?.id === id) item = this.latestItem;
    if (item?.done) { this.fail("protocol"); return; }
    if (!item) item = { id, played: 0, done: false };
    this.latestItem = item;
    let node: AudioBufferSourceNode | undefined;
    try {
      const buffer = context.createBuffer(1, binary.length / 2, RATE);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const unsigned = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
        samples[i] = (unsigned >= 32768 ? unsigned - 65536 : unsigned) / 32768;
      }
      node = context.createBufferSource();
      node.buffer = buffer;
      node.connect(this.outputAnalyser ?? context.destination);
      node.start(start);
      this.playback.push({ item, node, start, end: start + duration });
    } catch {
      if (node) { safely(() => node!.stop()); safely(() => node!.disconnect()); }
      this.fail("unsupported"); return;
    }
    this.publish({ status: "speaking" });
  }

  private interrupt(): void {
    this.prunePlayback();
    const time = this.audibleTime();
    const items = new Set(this.playback.map((part) => part.item));
    if (this.latestItem) items.add(this.latestItem);
    const interrupts = [...items].map((item) => ({
      type: "interrupt", item_id: item.id,
      audio_end_ms: Math.max(0, Math.floor((item.played + this.playback.reduce((played, part) =>
        played + (part.item === item ? Math.max(0, Math.min(time, part.end) - part.start) : 0), 0)) * 1000)),
    }));
    for (const item of items) this.retired.add(item.id);
    this.clearPlayback();
    if (this.retired.size > 256) { this.fail("limit"); return; }
    for (const message of interrupts) if (!this.send(message)) return;
    this.publish({ status: "listening" });
    this.sampleWaveform();
  }

  private tick(): void {
    if (!this.checkDeadline()) return;
    if (this.context) this.prunePlayback();
    const remainingSeconds = Math.ceil(this.budgetSeconds - this.elapsed());
    const status = this.ready ? (this.playback.length ? "speaking" : "listening") : "connecting";
    if (remainingSeconds !== this.state.remainingSeconds || status !== this.state.status) this.publish({ remainingSeconds, status });
  }

  private clearPlayback(): void {
    for (const part of this.playback) {
      safely(() => part.node.stop());
      safely(() => part.node.disconnect());
      safely(() => { part.node.buffer = null; });
    }
    this.playback = [];
    this.latestItem = undefined;
  }

  private fail(error: NonNullable<VoiceState["error"]>): void {
    this.finish({ status: "error", error });
  }

  private end(reason: NonNullable<VoiceState["reason"]>): void {
    this.finish({ status: "ended", reason, ...(reason === "time_limit" ? { remainingSeconds: 0 } : {}) });
  }

  private finish(patch: Partial<VoiceState>): void {
    if (this.terminal) return;
    this.terminal = true;
    this.ready = false;
    clearTimeout(this.phaseTimer);
    clearTimeout(this.deadlineTimer);
    clearInterval(this.tickTimer);
    clearInterval(this.waveformTimer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onHidden);
    if (typeof window !== "undefined") window.removeEventListener("pagehide", this.onPageHide);
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < MAX_SOCKET_BYTES) {
        safely(() => socket.send(JSON.stringify({ type: "stop" })));
      }
      // Closing a CONNECTING WebSocket aborts its handshake; stale callbacks are guarded too.
      safely(() => socket.close());
    }
    for (const track of this.stream?.getTracks() ?? []) {
      track.onended = null;
      safely(() => track.stop());
    }
    this.stream = undefined;
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.onprocessorerror = null;
      safely(() => this.worklet!.port.postMessage({ type: "stop" }));
      safely(() => this.worklet!.port.close());
      safely(() => this.worklet!.disconnect());
    }
    this.worklet = undefined;
    if (this.input) safely(() => this.input!.disconnect());
    this.input = undefined;
    this.clearPlayback();
    if (this.inputAnalyser) safely(() => this.inputAnalyser!.disconnect());
    if (this.outputAnalyser) safely(() => this.outputAnalyser!.disconnect());
    this.inputAnalyser = this.outputAnalyser = undefined;
    this.sampleWaveform();
    this.retired.clear();
    const context = this.context;
    this.context = undefined;
    if (context) safely(() => { void context.close().catch(() => {}); });
    this.finishStart?.();
    this.finishStart = undefined;
    this.publish(patch);
  }
}
