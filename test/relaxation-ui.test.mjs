import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as relaxation from "../lib/relaxation.ts";
import { audioHarness, flush } from "./relaxation-harness.mjs";

const source = readFileSync(new URL("../components/relaxation.tsx", import.meta.url), "utf8");
function mount(locale = "fr") {
  const env = audioHarness();
  const slots = [], effects = [], listeners = new Map();
  let cursor = 0, tree;
  const document = {
    visibilityState: "visible",
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const react = {
    useId() { return `relax-${cursor++}`; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, value => { slots[i].value = value; }]; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, index) => dep !== slots[i].deps[index])) {
        const previous = slots[i]; slots[i] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  class Session extends relaxation.RelaxationSession {
    constructor(onState) { super(onState, env.deps); }
  }
  const imports = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/image": { default: "Image" },
    "lucide-react": { Info: "Info", Play: "Play", Square: "Square", Volume2: "Volume2" }, "@/components/ui/button": { Button: "Button" },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "@/lib/relaxation": { ...relaxation, RelaxationSession: Session },
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, document, window: document, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name]; throw Error(`Unexpected dependency: ${name}`);
  } });
  const wrapper = exports.Relaxation({ locale });
  function nodes(node, found = []) {
    if (!node || typeof node !== "object") return found;
    if (Array.isArray(node)) { node.forEach(child => nodes(child, found)); return found; }
    found.push(node); nodes(node.props?.children, found); return found;
  }
  const ui = {
    ...env, document, listeners, exports, wrapper,
    render() { cursor = 0; tree = wrapper.type(wrapper.props); effects.splice(0).forEach(effect => effect()); return tree; },
    all: () => nodes(tree),
    find: predicate => nodes(tree).find(predicate),
    toggle() { ui.find(node => node.type === "Button").props.onClick(); },
    hidden() { document.visibilityState = "hidden"; listeners.get("visibilitychange")(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
  ui.render(); return ui;
}

for (const locale of ["fr", "en"]) {
  test(`${locale}: start gesture, slideshow, accessible timer and stable companion`, async () => {
    const ui = mount(locale);
    assert.equal(ui.contexts.length, 0);
    assert.equal(ui.find(n => n.props.role === "timer").props.children, "2:00");
    assert.equal(ui.find(n => n.props.role === "timer").props["aria-live"], "off");
    const button = ui.find(n => n.type === "Button");
    const clock = ui.find(n => "data-relaxation-clock" in n.props);
    assert.match(clock.props.className, /w-16 shrink-0 text-right/);
    assert.match(clock.props.className, /sm:w-20/);
    const notice = ui.find(n => n.props.id === button.props["aria-describedby"]);
    assert.match(notice.props.children, locale === "fr" ? /sans micro ni envoi/ : /no microphone or sending/);
    assert.match(JSON.stringify(button), locale === "fr" ? /Commencer avec le son/ : /Start with sound/);
    const range = ui.find(n => n.type === "input");
    assert.equal(range.props.type, "range");
    assert.ok(ui.find(n => n.type === "label" && n.props.htmlFor === range.props.id));
    assert.equal(range.props["aria-valuetext"], "20%");
    assert.equal(ui.find(n => n.type === "svg").props["aria-hidden"], "true");
    const portrait = ui.find(n => n.type === "Image");
    ui.toggle(); ui.toggle(); await flush(); ui.render();
    assert.equal(ui.contexts.length, 1);
    assert.equal(ui.find(n => "data-relaxation-ui" in n.props).props["data-state"], "playing");
    assert.deepEqual(ui.find(n => n.type === "Image"), portrait, "portrait never animates/rekeys between states");
    const status = ui.find(n => n.props.role === "status").props.children;
    ui.advance(24000); ui.render();
    assert.equal(ui.find(n => n.props.role === "timer").props.children, "1:36");
    assert.equal(ui.find(n => n.props.role === "status").props.children, status, "no every-second status announcements");
    const phrases = ui.all().filter(n => "data-relaxation-phrase" in n.props);
    assert.equal(phrases.filter(n => !n.props["aria-hidden"]).length, 1);
    assert.equal(phrases[1].props["data-active"], true);
    assert.ok(phrases.every(n => n.props.className.includes("motion-reduce:transition-none")));
    range.props.onChange({ target: { value: "0" } }); ui.render();
    assert.equal(ui.find(n => n.type === "input").props["aria-valuetext"], "0%");
    ui.advance(96000); await flush(); ui.render();
    assert.equal(ui.find(n => n.props.role === "timer").props.children, "0:00");
    assert.equal(ui.find(n => "data-relaxation-ui" in n.props).props["data-state"], "complete");
    assert.equal(ui.find(n => n.type === "Button").props.disabled, false);
    ui.toggle(); await flush(); ui.render();
    assert.equal(ui.find(n => n.props.role === "timer").props.children, "2:00");
    ui.unmount(); await flush();
    assert.equal(ui.listeners.size, 0); assert.equal(ui.timers.size, 0);
  });
}

for (const departure of ["hidden", "pagehide", "unmount"]) {
  test(`${departure} closes audio and never resumes in the background`, async () => {
    const ui = mount(); ui.toggle(); await flush(); ui.render();
    if (departure === "hidden") ui.hidden();
    if (departure === "pagehide") ui.listeners.get("pagehide")();
    if (departure === "unmount") ui.unmount();
    await flush(); ui.render();
    assert.equal(ui.contexts[0].state, "closed"); assert.equal(ui.timers.size, 0);
    if (departure === "hidden") {
      ui.toggle(); await flush(); assert.equal(ui.contexts.length, 1);
      ui.document.visibilityState = "visible"; ui.listeners.get("visibilitychange")();
      await flush(); assert.equal(ui.contexts.length, 1);
    }
    ui.unmount(); await flush();
  });
}

test("audio error offers an explicit retry, and locale/activity changes have cleanup boundaries", async () => {
  const ui = mount(); ui.controls.createError = true;
  ui.toggle(); await flush(); ui.render();
  assert.match(JSON.stringify(ui.find(n => n.type === "Button")), /Réessayer avec le son/);
  assert.match(ui.find(n => n.props.role === "status").props.children, /réessayer/);
  ui.controls.createError = false; ui.toggle(); await flush(); ui.render();
  assert.equal(ui.contexts.length, 1);
  assert.notEqual(ui.exports.Relaxation({ locale: "en" }).key, ui.wrapper.key);
  ui.unmount(); await flush(); assert.equal(ui.contexts[0].state, "closed");
  const activities = readFileSync(new URL("../components/demo-activities.tsx", import.meta.url), "utf8");
  assert.match(activities, /key=\{`\$\{activity\}-\$\{locale\}-\$\{generation\}`\}/);
  assert.match(activities, /<Relaxation locale=\{locale\} \/>/);
  assert.doesNotMatch(activities, /new AudioContext|function Relaxation/);
});

test("large colored quotes preserve their words while controls and explanations stay compact", async () => {
  const text = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children ?? "");
  for (const locale of ["fr", "en"]) {
    const ui = mount(locale);
    const phrases = ui.all().filter(n => "data-relaxation-phrase" in n.props);
    assert.deepEqual(phrases.map(text), [...relaxation.relaxationPhrases[locale]]);
    assert.ok(phrases.every(n => n.props.className.includes("text-[clamp(2rem,4.6vw,4rem)]")));
    assert.ok(ui.all().some(n => n.props.className === "nexo-relax-leaf"));
    const soundControls = ui.find(n => "data-relaxation-sound-controls" in n.props);
    assert.ok(soundControls.props.children.some(n => n.type === "details"), "volume and information wrap as one group on mobile");
    assert.equal(ui.find(n => n.type === "details").props.open, undefined);
    assert.ok(ui.find(n => n.type === "summary").props["aria-label"]);
    assert.equal(ui.find(n => n.props.role === "status").props.className, "sr-only");
    assert.equal(ui.find(n => n.type === "h3").props.className, "sr-only");
    assert.equal(ui.all().filter(n => n.type === "Button").length, 1);
    ui.controls.createError = true;
    ui.toggle(); await flush(); ui.render();
    assert.match(ui.find(n => n.props.role === "status").props.className, /text-destructive/);
    ui.unmount(); await flush();
  }
});

test("start, stop and restart keep a fixed width with distinct state colors", async () => {
  for (const locale of ["fr", "en"]) {
    const ui = mount(locale);
    const button = () => ui.find(n => n.type === "Button");
    const check = (action, color) => {
      assert.equal(button().props["data-action"], action);
      assert.match(button().props.className, /\bw-44\b/);
      assert.match(button().props.className, /shrink-0/);
      assert.ok(button().props.className.includes(color));
    };
    check("start", "bg-navy");
    ui.toggle(); await flush(); ui.render();
    check("stop", "bg-destructive");
    ui.toggle(); ui.render();
    check("stop", "bg-destructive");
    assert.equal(button().props.disabled, true);
    assert.equal(button().props.children[1], locale === "fr" ? "Arrêter" : "Stop");
    ui.advance(200); await flush(); ui.render();
    check("restart", "bg-sky");
    ui.toggle(); await flush(); ui.render();
    check("stop", "bg-destructive");
    ui.advance(120000); await flush(); ui.render();
    check("restart", "bg-sky");
    ui.controls.createError = true;
    ui.toggle(); await flush(); ui.render();
    check("restart", "bg-sky");
    ui.unmount(); await flush();
  }
});

test("relaxation fits its viewport without adding scroll to the scene", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = css.slice(css.indexOf("/* Fit the relaxation and breathing scenes"));
  assert.match(layout, /\.experience-shell:has\(\[data-relaxation-ui\], \[data-breathing-ui\]\).*height: 100dvh; min-height: 0/);
  assert.match(layout, /\.demo-panel:has\(> :is\(\[data-relaxation-ui\], \[data-breathing-ui\]\)\).*overflow: clip; container-type: size/);
  assert.match(layout, /\.nexo-relax-quote \{ font-size: clamp\(.*cqw.*cqh/);
  assert.match(layout, /\.mobile-experience-intro \{ display: none/);
  assert.match(layout, /\.experience-step-nav \{ position: static; display: grid/);
  assert.match(layout, /@media \(max-height: 500px\)/);
  assert.doesNotMatch(layout, /overflow[-xy]*: (auto|scroll)/);
});

test("organic waves use Nexo tokens and only animate with motion permission during playback", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const scoped = css.slice(css.indexOf(".nexo-relax-wave"), css.indexOf("@keyframes demo-reveal"));
  for (const token of ["sky", "voice-cell-2", "navy"]) assert.ok(scoped.includes(`var(--${token})`));
  assert.match(scoped, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(scoped, /\[data-state="playing"\] \.nexo-relax-wave \{ animation: nexo-relax-ripple 5\.6s/);
  assert.match(scoped, /fill: none/);
  assert.match(scoped, /transform-box: view-box/);
  assert.match(scoped, /0% \{ transform: scale\(0\.25\); opacity: 0;/);
  assert.match(scoped, /100% \{ transform: scale\(1\.12\); opacity: 0;/);
  for (const delay of ["-1.4s", "-2.8s", "-4.2s"]) assert.ok(scoped.includes(`animation-delay: ${delay}`));
  const ui = mount();
  assert.equal(ui.all().filter(n => n.props.className === "nexo-relax-wave").length, 4);
  assert.ok(ui.all().filter(n => n.props.className === "nexo-relax-wave").every(n => n.props.vectorEffect === "non-scaling-stroke"));
  assert.ok(ui.all().filter(n => n.props.className === "nexo-relax-wave").every(n => n.props.d.startsWith("M39 176C12 108")), "ripples keep their asymmetric, lobed outline rather than an ellipse");
  ui.unmount();
  assert.doesNotMatch(scoped, /#[0-9a-f]{3,8}\b/i);
  assert.match(source, /md:grid-cols-\[minmax\(0,0\.8fr\)_minmax\(0,1\.2fr\)\]/);
  assert.match(scoped, /color: var\(--ring\)/);
  assert.match(scoped, /color: var\(--voice-cell-3\)/);
  assert.match(scoped, /\[data-state="playing"\] \[data-active="true"\] \.nexo-relax-leaf \{ animation:/);
  assert.doesNotMatch(source, /requestAnimationFrame|fetch\(|localStorage|style=|<audio/);
});
