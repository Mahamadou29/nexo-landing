/* global AudioWorkletProcessor, registerProcessor, sampleRate */

// Box-filter streaming resampling: fractional input-frame coverage is carried between render
// quanta, avoiding both 44.1 kHz drift and per-quantum rounding. Never monitors the microphone.
class NexoPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 24000;
    this.enabled = false;
    this.stopped = false;
    this.generation = 0;
    this.inFlight = 0;
    this.reset();
    this.port.onmessage = ({ data }) => {
      if (!data || this.stopped) return;
      if (data.type === "stop") {
        this.enabled = false;
        this.stopped = true;
        this.sum = this.weight = this.count = this.inFlight = 0;
        this.pcm = this.view = null;
        this.port.onmessage = null;
        this.port.close();
      } else if (data.type === "capture" && Number.isInteger(data.generation)) {
        this.enabled = data.enabled === true;
        this.generation = data.generation;
        this.inFlight = 0;
        this.reset();
      } else if (data.type === "ack" && data.generation === this.generation) {
        this.inFlight = Math.max(0, this.inFlight - 1);
      }
    };
  }

  reset() {
    this.sum = 0;
    this.weight = 0;
    this.count = 0;
    this.pcm = new ArrayBuffer(4800);
    this.view = new DataView(this.pcm);
  }

  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    if (this.stopped) return false;
    const channels = inputs[0];
    if (!this.enabled || !channels?.length || !channels[0].length) return true;
    // At most two transferred chunks can wait for the main thread. Never accumulate a backlog.
    if (this.inFlight >= 2) { this.sum = this.weight = this.count = 0; return true; }
    for (let frame = 0; frame < channels[0].length; frame++) {
      let mono = 0;
      for (const channel of channels) mono += Number.isFinite(channel[frame]) ? channel[frame] : 0;
      mono /= channels.length;
      let remaining = 1;
      while (remaining > 1e-10) {
        const covered = Math.min(remaining, this.ratio - this.weight);
        this.sum += mono * covered;
        this.weight += covered;
        remaining -= covered;
        if (this.weight >= this.ratio - 1e-10) {
          const sample = Math.max(-1, Math.min(1, this.sum / this.ratio));
          this.view.setInt16(this.count * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
          this.count++;
          this.sum = this.weight = 0;
          if (this.count === 2400) {
            const pcm = this.pcm;
            this.port.postMessage({ type: "pcm", generation: this.generation, pcm }, [pcm]);
            this.inFlight++;
            this.count = 0;
            this.pcm = new ArrayBuffer(4800);
            this.view = new DataView(this.pcm);
            if (this.inFlight >= 2) return true;
          }
        }
      }
    }
    return true;
  }
}

registerProcessor("nexo-pcm", NexoPcmProcessor);
