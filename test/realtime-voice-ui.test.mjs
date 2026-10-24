import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { VoiceSignal, VOICE_BANDS } from "../lib/voice-signal.ts";
import { createVoiceCells, VOICE_VIEWBOX } from "../lib/voice-cell-geometry.ts";

const source = readFileSync(new URL("../components/realtime-voice.tsx", import.meta.url), "utf8");
const waveformSource = readFileSync(new URL("../components/voice-waveform.tsx", import.meta.url), "utf8");

// Execute the actual TSX handlers and SVG effects with inert browser/engine adapters.
// No server, WebSocket, AudioContext, microphone, React renderer dependency, or real permission.
function runtime(code, imports, globals = {}) {
  const slots = [];
  let cursor = 0;
  const pending = [];
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useId() { const index = cursor++; return slots[index] ??= `voice-id-${index}`; },
    useState(value) {
      const index = cursor++;
      slots[index] ??= { value };
      return [slots[index].value, next => { slots[index].value = next; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        slots[index] = { deps, cleanup: previous?.cleanup };
        pending.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
    useImperativeHandle(ref, create) { ref.current = create(); },
    useMemo(create, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) slots[index] = { deps, value: create() };
      return slots[index].value;
    },
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const compiled = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, ...globals,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return {
    exports,
    render(component, props) { cursor = 0; return component(props); },
    effects() { pending.splice(0).forEach(effect => effect()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

function ui(locale = "fr") {
  const sessions = [];
  const draws = [];
  const portals = [];
  const voiceNoticeTarget = {};
  const document = { activeElement: null };
  class Session {
    constructor(options) { this.options = options; this.state = { status: "idle", muted: false, remainingSeconds: 120 }; sessions.push(this); }
    emit(next) { this.state = { ...this.state, ...next }; this.options.onState(this.state); }
    start() { this.started = true; this.emit({ status: "connecting" }); return Promise.resolve(); }
    stop() { this.stopped = true; this.emit({ status: "ended" }); }
    setMuted(muted) { this.emit({ muted }); }
  }
  const run = runtime(source, {
    "next/image": { default: "Image" }, "next/link": { default: "Link" },
    "next/navigation": { usePathname: () => "/experience" },
    "react-dom": { createPortal: (node, target) => { portals.push({ node, target }); return node; } },
    "@/components/landing-provider": { useLanding: () => ({ voiceNoticeTarget }) },
    "lucide-react": { Mic: "Mic", MicOff: "MicOff", Square: "Square" },
    "@/components/ui/button": { Button: "Button" },
    "@/lib/landing-api": { API_BASE: "" },
    "@/lib/realtime-voice": { RealtimeVoiceSession: Session },
    "@/components/voice-waveform": { VoiceWaveformSvg: "Waveform" },
  }, { document });
  const wrapper = run.exports.RealtimeVoice({ locale });
  let nodes = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    nodes.push(node);
    visit(node.props?.children);
    if (node.props?.ref && typeof node.props.ref === "object") {
      node.props.ref.current = node.type === "Waveform" ? { draw: value => draws.push(value), setState: state => { env.visualState = state; } } : {
        focus() { document.activeElement = this; },
        contains(element) {
          const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
          return element === this || children.some(child => child?.props?.ref?.current === element);
        },
      };
    }
  }
  const env = {
    sessions, draws, portals, voiceNoticeTarget, run, document,
    render() { nodes = []; const tree = run.render(wrapper.type, wrapper.props); visit(tree); run.effects(); return tree; },
    find(type) { return nodes.find(node => node.type === type); },
    all(type) { return nodes.filter(node => node.type === type); },
    role(role) { return nodes.find(node => node.props?.role === role); },
    start() { env.find("button").props.onClick(); },
  };
  env.render();
  return env;
}

for (const locale of ["fr", "en"]) {
  test(`${locale}: a single explicit consent button starts audio only when activated`, () => {
    const env = ui(locale);
    assert.equal(env.sessions.length, 0);
    assert.equal(env.all("Button").length, 0, "no separate microphone start icon");
    assert.equal(env.all("button").length, 1);
    const start = env.find("button");
    const waveformRef = env.find("Waveform").props.ref;
    assert.equal(start.props.children, env.find("Waveform"), "the cells themselves are the native button");
    assert.equal(start.props.disabled, false);
    assert.equal(start.props["aria-label"], locale === "fr" ? "Accepter et commencer" : "Agree and start");
    const description = env.all("p").find(node => node.props.id === start.props["aria-describedby"]);
    assert.ok(description);
    assert.equal(env.portals.at(-1).target, env.voiceNoticeTarget);
    assert.equal(env.portals.at(-1).node.props.id, description.props.id);
    assert.match(JSON.stringify(description), locale === "fr" ? /Nexo traite ta voix/ : /Nexo processes your voice/);
    assert.equal(env.find("Link").props.href, "/conditions#conversation-vocale");
    assert.equal(env.find("input"), undefined);
    assert.match(env.find("section").props.className, /w-full min-w-0 max-w-lg flex-col items-center/);
    assert.match(start.props.className, /focus-visible:outline/);
    assert.equal(env.find("Mic"), undefined);
    assert.equal(env.find("Image").props.src, "/media/demo/ciel-speak.webp");
    assert.equal(env.role("timer").props["aria-live"], "off");
    const stage = env.all("div").find(node => "data-voice-stage" in node.props);
    const clock = env.all("div").find(node => "data-voice-clock" in node.props);
    const interaction = env.all("div").find(node => "data-voice-interaction" in node.props);
    assert.match(stage.props.className, /relative flex.*justify-center/);
    assert.match(clock.props.className, /absolute top-1\/2 right-0/);
    assert.match(clock.props.className, /md:left-\[calc\(50%\+13rem\)\]/);
    assert.match(interaction.props.className, /-mt-3.*items-center/);
    env.start();
    env.start();
    assert.equal(env.sessions.length, 1, "rapid repeat activation cannot create a second session");
    assert.equal(env.sessions[0].started, true, "start remains synchronous in the consent click gesture");
    assert.equal(env.sessions[0].options.consent, true);
    assert.equal(env.sessions[0].options.locale, locale);
    env.render();
    assert.equal(env.all("Button").length, 2);
    assert.equal(env.find("button").props.disabled, true);
    assert.equal(env.find("button").props.ref, start.props.ref);
    assert.equal(env.find("Waveform").props.ref, waveformRef, "same waveform remains inside the same start control");
    env.start();
    assert.equal(env.sessions.length, 1);
    assert.ok(env.all("Button").every(button => button.props.type === "button"));
    assert.ok(env.all("Button").every(button => button.props["aria-label"] && button.props.title));
    assert.ok(env.all("Button").every(button => /size-11/.test(button.props.className)));
    assert.equal(env.all("Button")[0].props["aria-pressed"], false);
    env.all("Button")[0].props.onClick();
    env.render();
    assert.equal(env.all("Button")[0].props["aria-pressed"], true);
    assert.equal(env.all("Button")[0].props["aria-label"], locale === "fr" ? "Réactiver le micro" : "Unmute microphone");
    env.all("Button")[1].props.onClick();
    env.render();
    assert.equal(env.sessions[0].stopped, true);
    assert.equal(env.all("Button").length, 0, "terminal view removes both secondary controls");
    assert.equal(env.find("button").props.disabled, false);
    assert.equal(env.find("Waveform").props.ref, waveformRef);
  });
}

test("keyboard focus follows disabled start/removed active controls without stealing external focus", () => {
  const env = ui();
  env.find("button").props.ref.current.focus();
  env.start(); env.render();
  assert.equal(env.document.activeElement, env.find("Button").props.ref.current, "start transfers focus to the microphone control");
  env.sessions[0].stop(); env.render();
  assert.equal(env.document.activeElement, env.find("button").props.ref.current, "ending returns focus to start");
  assert.equal(env.sessions.length, 1, "ending does not automatically restart or carry over consent");
  env.start(); env.render();
  const externalFocus = {};
  env.document.activeElement = externalFocus;
  env.sessions[1].stop(); env.render();
  assert.equal(env.document.activeElement, externalFocus);
});

test("actual frames bypass React state, terminal/stale frames are ignored and lifecycle still stops", () => {
  const env = ui();
  env.start(); env.render();
  const first = env.sessions[0];
  const frame = { input: new Float32Array([0, 0.4, -0.4]), output: new Float32Array(3) };
  first.options.onWaveform(frame);
  assert.equal(env.draws.at(-1), null, "connecting is neutral");
  first.emit({ status: "listening" }); env.render();
  first.options.onWaveform(frame);
  assert.equal(env.draws.at(-1), frame, "original measured samples reach SVG analysis directly");
  env.all("Button")[1].props.onClick(); env.render();
  assert.equal(first.stopped, true);
  assert.equal(env.draws.at(-1), null);
  first.options.onWaveform(frame);
  assert.equal(env.draws.at(-1), null);
  env.start(); env.render();
  first.emit({ status: "speaking" }); first.options.onWaveform(frame);
  assert.equal(env.draws.at(-1), null, "a superseded engine cannot paint");
  env.run.unmount();
  assert.equal(env.sessions[1].stopped, true);
  env.sessions[1].options.onWaveform(frame);
  assert.equal(env.draws.at(-1), null, "unmount invalidates callback ownership before stop");
});

test("FR/EN errors, deadline messages and timer survive the simplified controls", () => {
  for (const locale of ["fr", "en"]) {
    const env = ui(locale);
    env.start(); env.render();
    env.sessions[0].emit({ status: "listening", remainingSeconds: 65 }); env.render();
    assert.match(JSON.stringify(env.role("timer").props.children), /1.*:.*05/);
    env.sessions[0].emit({ status: "ended", reason: "time_limit", remainingSeconds: 0 }); env.render();
    assert.match(JSON.stringify(env.role("status").props.children), /2 minutes/);
    for (const error of ["unavailable", "connection", "protocol", "limit", "rate_limited", "busy", "microphone", "unsupported", "timeout"]) {
      env.sessions[0].emit({ status: "error", error }); env.render();
      assert.equal(typeof env.role("alert").props.children, "string");
      assert.ok(env.role("alert").props.children.length > 15);
      if (error === "rate_limited") assert.match(env.role("alert").props.children, locale === "fr" ? /tentatives/ : /attempts/);
      if (error === "busy") assert.match(env.role("alert").props.children, locale === "fr" ? /occupé/ : /busy/);
      if (error === "rate_limited" || error === "busy") assert.doesNotMatch(env.role("alert").props.children, /audio/i);
    }
  }
});

test("activity panels no longer display the AI demo badge", () => {
  const activities = readFileSync(new URL("../components/demo-activities.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(activities, /AI demo|Démo avec une IA|t\.live/);
  assert.match(activities, /activity === "breathing" && <p/);
  assert.match(activities, /\{t\.local\}/);
  const relaxation = readFileSync(new URL("../components/relaxation.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(relaxation, /AI demo|Démo avec une IA/);
  assert.match(relaxation, /sans micro ni envoi/);
});

function signalFrame(input = 0.35, output = 0, frequencyBin = 5) {
  const frame = {
    input: new Float32Array(256).fill(input), output: new Float32Array(256).fill(output),
    inputFrequency: new Float32Array(128).fill(-Infinity), outputFrequency: new Float32Array(128).fill(-Infinity), sampleRate: 48000,
  };
  frame.inputFrequency[frequencyBin] = input ? -12 : -Infinity;
  frame.outputFrequency[frequencyBin] = output ? -12 : -Infinity;
  return frame;
}

function svgEnvironment(reduced = false, props = {}) {
  let now = 0;
  let nextFrame = 0;
  const frames = new Map();
  const listeners = new Map();
  const visibility = new Map();
  const pageEvents = new Map();
  const cells = [];
  const paths = [];
  let microphone;
  const gradients = [];
  const stops = [];
  const motion = { matches: reduced, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const document = { visibilityState: "visible", addEventListener: (name, fn) => visibility.set(name, fn), removeEventListener: name => visibility.delete(name) };
  const run = runtime(waveformSource, { "@/lib/voice-signal": { VoiceSignal, VOICE_BANDS }, "@/lib/voice-cell-geometry": { createVoiceCells, VOICE_VIEWBOX } }, {
    window: { matchMedia: () => motion, addEventListener: (name, fn) => pageEvents.set(name, fn), removeEventListener: name => pageEvents.delete(name) },
    document, performance: { now: () => now },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id),
  });
  const ref = { current: null };
  const tree = run.render(run.exports.VoiceWaveformSvg, { ref, ...props });
  const attributes = {};
  tree.props.ref.current = { setAttribute: (key, value) => { attributes[key] = value; } };
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    if (node.type === "g") {
      const cell = { ...node.props, setAttribute(key, value) { this[key] = value; } };
      if ("data-voice-microphone" in node.props) {
        microphone = cell; node.props.ref.current = cell;
      } else {
        cells.push(cell); node.props.ref(cell);
      }
    }
    if (node.type === "stop") {
      const stop = { ...node.props, setAttribute(key, value) { this[key] = value; } };
      stops.push(stop); node.props.ref(stop);
    }
    if (node.type === "path" && !("data-voice-mic-shape" in node.props)) paths.push(node.props);
    if (node.type === "radialGradient") gradients.push(node.props);
    visit(node.props?.children);
  }
  visit(tree);
  run.effects();
  return {
    cells, paths, microphone, gradients, stops, ref, tree, motion, listeners, run, frames, attributes, document, visibility, pageEvents,
    advance(ms = 16) { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)); },
    measured(frame = signalFrame(), steps = 20) { for (let i = 0; i < steps; i++) { ref.current.draw(frame); this.advance(); } },
    active(muted = false) { ref.current.setState({ status: "listening", muted }); },
    requests() { return nextFrame; },
    visible() { return cells.filter(cell => Number(cell.opacity) > 0.01).length; },
  };
}

test("SVG renders 23 stable organic columns, at most seven cells, no contour and token palette", () => {
  const env = svgEnvironment();
  assert.equal(env.tree.type, "svg");
  assert.equal(env.tree.props["aria-hidden"], "true");
  assert.equal(env.tree.props.focusable, "false");
  assert.equal(env.tree.props.viewBox, "0 0 600 180");
  assert.match(env.tree.props.className, /h-32 w-full max-w-sm/);
  assert.equal(env.cells.length, 23 * 7);
  assert.equal(env.visible(), 0, "the resting button is a clean microphone, not a cell tile");
  assert.equal(Number(env.microphone.opacity), 1);
  assert.equal(env.cells.filter(cell => cell["data-voice-ivory"]).length, 17, "transition materials retain stable cell identities");
  assert.equal(env.frames.size, 0, "no idle loop");
  assert.equal(env.gradients.length, 161);
  assert.match(env.stops[1]["stop-color"], /--voice-rest-blue/);
  assert.match(env.stops[0]["stop-color"], /38%, var\(--ivory\)/, "broad pale crest gives the pebble volume");
  assert.match(env.stops[2]["stop-color"], /66%, var\(--voice-rest-deep\)/, "confined edge shading, not an exterior shadow");
  assert.match(env.stops.at(-2)["stop-color"], /--voice-rest-blue/);
  const identities = env.paths.map(path => path.d);
  assert.ok(new Set(identities).size > 1, "small deterministic shape asymmetry");
  assert.ok(env.paths.every(path => !path.stroke && !path.filter));
  env.active(); env.advance(560);
  assert.equal(Number(env.microphone.opacity), 0, "the microphone is hidden during the conversation");
  assert.match(env.stops[1]["stop-color"], /--voice-cell-1/);
  assert.match(env.stops.at(-2)["stop-color"], /--voice-cell-5/);
  const requests = env.requests();
  env.measured(signalFrame(0, 0));
  assert.equal(env.visible(), 5, "active silence, unlike the start button, stays minimal");
  assert.equal(env.requests(), requests, "repeated silence does not schedule render work after the finite morph");
  env.measured();
  assert.ok(env.visible() > 5);
  assert.deepEqual(env.paths.map(path => path.d), identities, "identities stay fixed while transforms change");
  assert.ok(env.cells.every(cell => !/NaN|Infinity/.test(cell.transform)));
  env.run.unmount();
});

test("same fitted cells and their materials morph finitely and return on an interrupted or ended session", () => {
  const env = svgEnvironment();
  const poses = env.cells.map(cell => cell.transform);
  const materials = env.stops.map(stop => stop["stop-color"]);
  const paths = env.paths.map(path => path.d);
  env.ref.current.setState({ status: "connecting", muted: false });
  env.advance(280);
  assert.equal(env.attributes["data-voice-morph"], "0.500");
  assert.equal(Number(env.microphone.opacity), 0.5, "microphone fades continuously as the waveform opens");
  assert.ok(env.visible() > 0);
  assert.notDeepEqual(env.cells.map(cell => cell.transform), poses);
  assert.match(env.stops[1]["stop-color"], /--voice-rest-blue/);
  assert.match(env.stops[1]["stop-color"], /--voice-cell-1/);
  for (const status of ["error", "ended"]) {
    env.ref.current.setState({ status, muted: false });
    env.ref.current.draw(null);
    env.advance(560);
    assert.equal(env.attributes["data-voice-phase"], "button");
    assert.equal(env.attributes["data-voice-morph"], "0.000");
    assert.deepEqual(env.cells.map(cell => cell.transform), poses);
    assert.deepEqual(env.stops.map(stop => stop["stop-color"]), materials);
    assert.deepEqual(env.paths.map(path => path.d), paths, "cell shapes stay stable through the return transition");
    assert.equal(Number(env.microphone.opacity), 1, "the microphone returns after the session");
    assert.equal(env.visible(), 0);
    assert.equal(env.frames.size, 0);
    env.active(); env.advance(560); env.measured();
  }
  env.run.unmount();
  const reduced = svgEnvironment(true);
  reduced.active();
  assert.equal(reduced.attributes["data-voice-morph"], "1.000");
  reduced.ref.current.setState({ status: "ended", muted: false });
  assert.equal(reduced.visible(), 0);
  assert.equal(Number(reduced.microphone.opacity), 1);
  assert.equal(reduced.frames.size, 0, "reduced motion goes straight to the correct endpoint");
  reduced.run.unmount();
});

test("active measured SVG reveals three plump crests, not a uniform equalizer; silence stays minimal", () => {
  const env = svgEnvironment(); env.active(); env.measured(signalFrame(1, 1), 100);
  const counts = Array.from({ length: 23 }, (_, column) => env.cells.filter(cell => cell["data-voice-column"] === column && Number(cell.opacity) > 0.2).length);
  for (const crest of [5, 12, 19]) assert.equal(counts[crest], 7);
  for (const saddle of [9, 16]) assert.equal(counts[saddle], 1);
  assert.ok(new Set(counts).size >= 4);
  const still = env.cells.map(cell => cell.transform);
  env.measured(signalFrame(1, 1), 20);
  assert.deepEqual(env.cells.map(cell => cell.transform), still, "constant measured energy cannot invent movement");
  const heightClass = env.tree.props.className;
  env.ref.current.draw(null);
  assert.equal(env.visible(), 5);
  assert.equal(env.tree.props.className, heightClass, "the taller pebble slot is identical for rest and activity");
  env.run.unmount();
});

test("actual SVG consumes borrowed buffers immediately; attack/release, spectrum and output drive cells", () => {
  const env = svgEnvironment(); env.active(); env.advance(560);
  const sample = signalFrame();
  env.ref.current.draw(sample);
  sample.input.fill(0); sample.inputFrequency.fill(-Infinity);
  env.advance(64);
  assert.ok(env.visible() > 5, "features copied before engine reuses its arrays");
  const initial = env.cells.map(cell => cell.transform);
  env.measured(signalFrame());
  assert.notDeepEqual(env.cells.map(cell => cell.transform), initial, "progressive attack");
  const lowBand = env.cells.map(cell => cell.transform);
  env.measured(signalFrame(0.35, 0, 35));
  assert.notDeepEqual(env.cells.map(cell => cell.transform), lowBand, "frequency changes affect column distribution");
  env.active(true);
  assert.equal(env.visible(), 5, "mute discards the microphone envelope immediately");
  env.measured(signalFrame());
  assert.equal(env.visible(), 5, "muted microphone cannot animate");
  env.measured(signalFrame(0, 0.4));
  assert.ok(env.visible() > 5, "muted output still animates");
  env.ref.current.draw(signalFrame(0, 0)); env.advance();
  assert.ok(env.visible() > 5, "release is gradual, not a hard cut");
  for (let i = 0; i < 160; i++) env.advance();
  assert.equal(env.visible(), 5);
  assert.equal(env.frames.size, 0, "silence parks rAF");
  env.active(); env.measured();
  for (let i = 0; i < 160; i++) env.advance();
  assert.equal(env.visible(), 5, "missing callbacks decay without fake activity");
  env.run.unmount();
});

test("waiting, errors, stop, hide, pagehide, reduced motion and unmount clear all visual work", () => {
  const env = svgEnvironment();
  const rest = env.cells.map(cell => cell.transform);
  env.ref.current.setState({ status: "connecting", muted: false });
  env.advance(560); env.measured();
  assert.equal(env.attributes["data-voice-phase"], "connecting");
  assert.equal(env.visible(), 5);
  assert.notDeepEqual(env.cells.map(cell => cell.transform), rest, "connection is distinct but static");
  assert.equal(env.frames.size, 0);
  for (const status of ["idle", "ended", "error"]) {
    env.active(); env.measured();
    env.ref.current.setState({ status, muted: false });
    env.advance(560); env.measured();
    assert.equal(env.visible(), 0); assert.equal(Number(env.microphone.opacity), 1); assert.equal(env.frames.size, 0);
  }
  env.active(); env.measured();
  env.document.visibilityState = "hidden"; env.visibility.get("visibilitychange")();
  env.measured(); assert.equal(env.visible(), 5); assert.equal(env.frames.size, 0);
  env.document.visibilityState = "visible";
  env.measured(); env.pageEvents.get("pagehide")();
  assert.equal(env.visible(), 5); assert.equal(env.frames.size, 0);
  env.measured(); env.motion.matches = true; env.listeners.get("change")();
  env.measured(); assert.equal(env.visible(), 5); assert.equal(env.frames.size, 0);
  env.motion.matches = false; env.listeners.get("change")();
  env.measured(); assert.ok(env.visible() > 5);
  env.ref.current.draw(null); assert.equal(env.visible(), 5);
  env.measured(); env.run.unmount();
  const stopped = env.cells.map(cell => cell.transform);
  env.ref.current.draw(signalFrame()); env.advance();
  assert.deepEqual(env.cells.map(cell => cell.transform), stopped);
  assert.equal(env.frames.size + env.listeners.size + env.visibility.size + env.pageEvents.size, 0);
  const reduced = svgEnvironment(true); reduced.active(); reduced.measured();
  assert.equal(reduced.visible(), 5); assert.equal(reduced.frames.size, 0);
  reduced.run.unmount();
});

test("reusable SVG bounds spacing/columns/deformation and accepts a custom palette", () => {
  for (const columns of [19, 27, 999, NaN]) {
    const env = svgEnvironment(false, { columns, spacing: 100, deformation: Infinity, palette: ["a", "b", "c", "d", "e"] });
    assert.ok(env.cells.length >= 19 * 7 && env.cells.length <= 27 * 7);
    env.active(); env.measured(signalFrame(1, 1));
    assert.ok(env.cells.every(cell => !/NaN|Infinity/.test(cell.transform)));
    env.advance(560);
    assert.match(env.stops[1]["stop-color"], /a 100%/);
    env.run.unmount();
  }
});

test("UI retains desktop internal scrolling without fake animation", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.demo-panel \{ flex: 1; overflow-y: auto;/);
  assert.match(source, /<section data-voice-ui/);
  assert.match(waveformSource, /<svg data-voice-waveform/);
  assert.match(source, /active && <div data-voice-controls/);
  assert.match(css, /@media \(min-width: 1024px\) and \(max-height: 700px\) \{\s*\[data-voice-ui\]/);
  assert.match(css, /\[data-voice-ui\] \[data-voice-controls\] \{ min-height: 44px; \}/);
  assert.doesNotMatch(source, /Azure|OpenAI/i);
  assert.doesNotMatch(waveformSource, /setInterval|Math\.random|Math\.sin|useState|AudioContext|getUserMedia|\.close\(/);
  assert.match(waveformSource, /requestAnimationFrame/);
  assert.match(waveformSource, /cancelAnimationFrame/);
  assert.match(source, /key=\{`\$\{pathname\}-\$\{locale\}`\}/);
});
