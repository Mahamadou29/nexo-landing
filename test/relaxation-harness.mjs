export const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function audioHarness() {
  let now = 0;
  let serial = 0;
  const timers = new Map();
  const contexts = [];
  const controls = { resume: null, close: null, createError: false, nodeError: false };
  class Parameter {
    value = 0;
    events = [];
    setValueAtTime(...args) { this.events.push(["set", ...args]); }
    linearRampToValueAtTime(...args) { this.events.push(["ramp", ...args]); }
    setTargetAtTime(...args) { this.events.push(["target", ...args]); }
    cancelScheduledValues(...args) { this.events.push(["cancel", ...args]); }
    cancelAndHoldAtTime(...args) { this.events.push(["hold", ...args]); }
  }
  class Node {
    gain = new Parameter(); frequency = new Parameter(); connections = []; stops = []; starts = [];
    connect(destination) { this.connections.push(destination); }
    disconnect() { this.disconnected = true; }
    start(time) { this.starts.push(time); }
    stop(time) { this.stops.push(time); }
  }
  class Context {
    state = "suspended"; nodes = []; destination = {}; currentTime = 0; closeCalls = 0; resumeCalls = 0;
    async resume() { this.resumeCalls++; if (controls.resume) await controls.resume.promise; if (this.state !== "closed") this.state = "running"; }
    async close() { this.closeCalls++; if (controls.close) await controls.close.promise; this.state = "closed"; }
    createGain() { const node = new Node(); this.nodes.push(node); return node; }
    createOscillator() { if (controls.nodeError) throw Error("output failed"); const node = new Node(); node.oscillator = true; this.nodes.push(node); return node; }
  }
  const deps = {
    now: () => now,
    createContext() { if (controls.createError) throw Error("unsupported"); const context = new Context(); contexts.push(context); return context; },
    setTimer(callback, delay) { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimer(id) { timers.delete(id); },
  };
  return {
    deps, contexts, controls, timers,
    // Deliver all due callbacks once at the new time, modelling a throttled tab.
    advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } },
  };
}
