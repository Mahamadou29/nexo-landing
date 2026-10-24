import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bindBreathingLifecycle, BreathingSession, breathingFrame, formatBreathingTime } from "../lib/breathing.ts";

function setup() {
  let now = 0, id = 0;
  const callbacks = new Map(), states = [], frames = [];
  const clock = { now: () => now, request: fn => { callbacks.set(++id, fn); return id; }, cancel: key => callbacks.delete(key) };
  const session = new BreathingSession(state => states.push(state), frame => frames.push(frame), clock);
  return { session, callbacks, states, frames, state: () => states.at(-1), advance(ms) { now += ms; const pending = [...callbacks.values()]; callbacks.clear(); for (const fn of pending) fn(); } };
}

test("four-second inhale and six-second exhale share continuous expansion, without holds", () => {
  assert.equal(breathingFrame(0).expansion, 0);
  assert.equal(breathingFrame(2000).phase, "inhale");
  assert.ok(Math.abs(breathingFrame(2000).expansion - 0.5) < 0.00001);
  assert.equal(breathingFrame(3999).phase, "inhale");
  assert.equal(breathingFrame(4000).phase, "exhale");
  assert.equal(breathingFrame(4000).expansion, 1);
  assert.equal(breathingFrame(4000).phaseSeconds, 6);
  assert.ok(Math.abs(breathingFrame(7000).expansion - 0.5) < 0.00001);
  assert.equal(breathingFrame(10000).phase, "inhale");
  assert.equal(breathingFrame(10000).expansion, 0);
  assert.deepEqual(breathingFrame(-1000), breathingFrame(0));
  assert.deepEqual(breathingFrame(65000), breathingFrame(60000));
  assert.equal(breathingFrame(60000).complete, true);
  assert.equal(breathingFrame(60000).remainingSeconds, 0);
  assert.equal(formatBreathingTime(60), "1:00");
  assert.equal(formatBreathingTime(9), "0:09");
  assert.equal(formatBreathingTime(0), "0:00");
});

test("no automatic start; duplicate starts do not create additional animation loops", () => {
  const env = setup();
  assert.equal(env.callbacks.size, 0);
  assert.equal(env.states.length, 0);
  env.session.start(); env.session.start();
  assert.equal(env.callbacks.size, 1);
  assert.equal(env.state().status, "running");
  env.advance(16); env.advance(16);
  assert.equal(env.states.length, 1, "React state does not update every visual frame");
  assert.equal(env.frames.length, 3);
  env.advance(3968);
  assert.deepEqual(env.state(), { status: "running", phase: "exhale", remainingSeconds: 56, phaseSeconds: 6 });
  env.session.dispose();
});

test("delayed frames catch up from monotonic time and completion releases the RAF", () => {
  const env = setup(); env.session.start();
  env.advance(17000);
  assert.equal(env.state().phase, "exhale");
  assert.equal(env.state().remainingSeconds, 43);
  assert.equal(env.state().phaseSeconds, 3);
  env.advance(46000);
  assert.equal(env.state().status, "complete");
  assert.equal(env.state().remainingSeconds, 0);
  assert.equal(env.callbacks.size, 0);
  env.session.start();
  assert.equal(env.state().remainingSeconds, 60);
  assert.equal(env.frames.at(-1).expansion, 0);
  env.session.dispose();
});

test("stop freezes time and cancels pending work; restart always starts a fresh minute", () => {
  const env = setup(); env.session.start(); env.advance(5300);
  const stale = [...env.callbacks.values()][0];
  env.session.stop();
  assert.equal(env.state().status, "stopped");
  assert.equal(env.callbacks.size, 0);
  env.advance(20000);
  assert.equal(env.state().remainingSeconds, 55);
  env.session.start();
  stale();
  assert.equal(env.callbacks.size, 1, "an old RAF callback cannot revive the prior session");
  assert.equal(env.state().remainingSeconds, 60);
  assert.equal(env.state().phase, "inhale");
  env.session.dispose();
  const count = env.states.length;
  env.session.start(); env.session.stop(); stale();
  assert.equal(env.callbacks.size, 0);
  assert.equal(env.states.length, count);
});

test("hidden tab and pagehide stop, returning never resumes, cleanup removes all listeners", () => {
  const env = setup();
  const visibility = new EventTarget(); visibility.visibilityState = "visible";
  const page = new EventTarget();
  const cleanup = bindBreathingLifecycle(env.session, visibility, page);
  env.session.start(); env.advance(1000);
  visibility.visibilityState = "hidden"; visibility.dispatchEvent(new Event("visibilitychange"));
  assert.equal(env.state().status, "stopped");
  assert.equal(env.callbacks.size, 0);
  visibility.visibilityState = "visible"; visibility.dispatchEvent(new Event("visibilitychange"));
  assert.equal(env.state().status, "stopped");
  env.session.start(); page.dispatchEvent(new Event("pagehide"));
  assert.equal(env.state().status, "stopped");
  env.session.start(); cleanup();
  const count = env.states.length;
  visibility.visibilityState = "hidden"; visibility.dispatchEvent(new Event("visibilitychange")); page.dispatchEvent(new Event("pagehide"));
  assert.equal(env.states.length, count);
  assert.equal(env.callbacks.size, 0);
  cleanup();
});

test("the expanded aura clears both horizontal panel edges without opening vertical scroll", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.experience-demo:has\(\[data-breathing-ui\]\), \.demo-panel:has\(> \[data-breathing-ui\]\) \{ overflow-x: visible; \}/);
  assert.match(css, /\.demo-panel:has\(> :is\(\[data-relaxation-ui\], \[data-breathing-ui\]\)\) \{[^}]*overflow: clip;/);
  assert.match(css, /\.experience-shell:has\(\[data-relaxation-ui\], \[data-breathing-ui\]\) \{[^}]*overflow: clip;/);
});

test("locale/activity boundaries, reduced-motion guide, quiet accessible controls and local-only scope", () => {
  const component = readFileSync(new URL("../components/breathing.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/breathing.css", import.meta.url), "utf8");
  const logic = readFileSync(new URL("../lib/breathing.ts", import.meta.url), "utf8");
  const demo = readFileSync(new URL("../components/demo-activities.tsx", import.meta.url), "utf8");
  assert.match(component, /<BreathingMoment key=\{locale\}/);
  assert.match(demo, /key=\{`\$\{activity\}-\$\{locale\}-\$\{generation\}`\}/);
  assert.match(component, /bindBreathingLifecycle\(current, document, window\)/);
  assert.match(component, /cleanup\(\)/);
  assert.match(component, /motion\.removeEventListener\("change", draw\)/);
  assert.match(component, /motion.matches \? 0.45 : lastExpansion/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(component, /role="timer" aria-live="off"/);
  assert.match(component, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(component, /data-breathing-toggle[^\n]+w-44/);
  assert.match(component, /data-breathing-clock[^\n]+w-12 shrink-0 text-right[^\n]+sm:w-20/);
  assert.match(component, /const scale = 0\.69 \+ expansion \* 1\.51/);
  assert.match(component, /setAttribute\("opacity", `\$\{0\.85 - expansion \* 0\.32\}`\)/);
  assert.match(css, /\[data-breathing-organic\] \{ overflow: visible; \}/);
  assert.match(css, /\[data-breathing-guide\] \{ position: relative; z-index: 1;/);
  assert.match(component, /bg-destructive text-ivory/);
  assert.match(component, /bg-sky text-navy/);
  assert.match(component, /bg-navy text-ivory/);
  assert.match(component, /popover="auto"/);
  assert.match(component, /popoverTargetAction="hide"/);
  assert.match(css, /@container \(max-height: 220px\)/);
  assert.match(css, /height: 100%/);
  assert.match(css, /21cqh/);
  assert.match(component, /sans retenir ton souffle/);
  assert.match(component, /without holding your breath/);
  assert.doesNotMatch(component + logic, /fetch\(|AudioContext|MediaRecorder|getUserMedia|setInterval|setTimeout/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\.demo-panel|\.experience-shell/);
});
