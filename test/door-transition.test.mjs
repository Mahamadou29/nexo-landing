import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as transition from "../lib/door-transition.ts";

const { cellGeometry, createDoorTransition, doorTiming } = transition;
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const request = (character = "ciel") => ({ character, href: character === "ciel" ? "/decouvrir" : "/experience", geometry: cellGeometry(130, 240, 390, 844) });
function harness(options = {}) {
  const calls = [], animations = [], timers = new Set(), paints = new Set();
  let pending = false;
  const driver = {
    reduced: () => false, hidden: () => false, supported: () => true,
    prepare: value => calls.push(["prepare", value]),
    phase: value => calls.push(["phase", value]),
    animate: (phase, value) => {
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const animation = { phase, value, finished, resolve, reject, cancelled: false, cancel() { this.cancelled = true; reject(Error("cancelled")); } };
      animations.push(animation);
      return animation;
    },
    push: href => calls.push(["push", href]),
    focus: href => calls.push(["focus", href]),
    schedule: (callback, delay) => { const timer = { callback, delay }; timers.add(timer); return () => timers.delete(timer); },
    afterPaint: callback => { paints.add(callback); return () => paints.delete(callback); },
    reset: () => { for (const animation of animations) animation.cancel(); },
    pending: value => { pending = value; },
    ...options,
  };
  const controller = createDoorTransition(driver);
  return {
    controller, calls, animations, timers, paints,
    get pending() { return pending; },
    count: type => calls.filter(call => call[0] === type).length,
    paint() { const callbacks = [...paints]; paints.clear(); callbacks.forEach(callback => callback()); },
    deadline() { for (const timer of [...timers]) timer.callback(); },
    async cover() { animations[0].resolve(); await flush(); },
  };
}

for (const character of ["ciel", "noir"]) {
  test(`${character}: opaque cover precedes a single push; only hydrated matching content reveals`, async () => {
    const h = harness(), r = request(character);
    assert.equal(h.controller.begin(r), true);
    assert.equal(h.controller.phase, "covering");
    assert.equal(h.count("push"), 0);
    await h.cover();
    assert.equal(h.controller.phase, "waiting");
    const pushIndex = h.calls.findIndex(call => call[0] === "push");
    assert.deepEqual(h.calls[pushIndex - 1], ["phase", "waiting"]);
    h.controller.route(r.href);
    assert.equal(h.animations.length, 1, "a pathname / loading fallback is not readiness");
    h.controller.ready("/unrelated");
    assert.equal(h.paints.size, 0);
    h.controller.ready(r.href);
    assert.equal(h.animations.length, 1, "App Router gets its scroll/focus pass first");
    h.paint();
    assert.equal(h.animations[1].phase, "revealing");
    h.animations[1].resolve(); await flush();
    assert.equal(h.controller.phase, "idle");
    assert.equal(h.count("push"), 1);
    assert.deepEqual(h.calls.at(-1), ["focus", r.href]);
    assert.equal(h.timers.size + h.paints.size, 0);
    assert.ok(h.animations.every(animation => animation.cancelled));
  });
}

test("readiness may precede the provider pathname effect, but not the navigation intent", async () => {
  const h = harness(); h.controller.begin(request());
  h.controller.ready("/decouvrir");
  await h.cover();
  h.controller.route("/decouvrir");
  assert.equal(h.paints.size, 0, "pre-navigation readiness was ignored");
  h.controller.ready("/decouvrir"); h.paint();
  assert.equal(h.animations.length, 2);
  h.controller.cancel();
  const second = harness(); second.controller.begin(request()); await second.cover();
  second.controller.ready("/decouvrir");
  assert.equal(second.paints.size, 0);
  second.controller.route("/decouvrir"); second.paint();
  assert.equal(second.animations.length, 2);
  second.controller.cancel();
});

test("rapid opposite-door clicks cannot start a second timeline or push", async () => {
  const h = harness();
  h.controller.begin(request());
  for (let i = 0; i < 10; i++) assert.equal(h.controller.begin(request("noir")), true);
  assert.equal(h.animations.length, 1);
  await h.cover();
  assert.equal(h.count("push"), 1);
  assert.equal(h.calls.find(call => call[0] === "push")[1], "/decouvrir");
  h.controller.cancel(); await flush();
});

test("reduced motion, hidden tabs, unsupported animation and non-home routes stay native", () => {
  for (const option of [{ reduced: () => true }, { hidden: () => true }, { supported: () => false }]) {
    const h = harness(option);
    assert.equal(h.controller.begin(request()), false);
    assert.equal(h.calls.length + h.timers.size + h.animations.length, 0);
  }
  const h = harness(); h.controller.route("/experience");
  assert.equal(h.controller.begin(request()), false);
  assert.equal(h.animations.length, 0);
});

test("history, unrelated route and unmount cancellation invalidate delayed cover callbacks", async () => {
  for (const cancel of [h => h.controller.cancel(), h => h.controller.route("/conditions"), h => h.controller.route("/decouvrir")]) {
    const h = harness(); h.controller.begin(request());
    const old = h.animations[0]; cancel(h); old.resolve(); await flush(); h.deadline(); h.paint();
    assert.equal(h.count("push"), 0);
    assert.equal(h.count("focus"), 0);
    assert.equal(h.controller.phase, "idle");
    assert.equal(h.timers.size + h.paints.size, 0);
  }
});

test("cancelled promises and stale readiness cannot finish a later transition", async () => {
  const h = harness(); h.controller.begin(request());
  const first = h.animations[0]; h.controller.cancel();
  h.controller.begin(request("noir")); first.resolve(); await flush();
  h.controller.ready("/decouvrir");
  assert.equal(h.controller.phase, "covering");
  assert.equal(h.count("push"), 0);
  h.animations[1].resolve(); await flush();
  assert.deepEqual(h.calls.filter(call => call[0] === "push"), [["push", "/experience"]]);
  h.controller.cancel();
});

test("resize / hiding / preference changes expedite once, without replay or an overlay", async () => {
  for (const alreadyPushed of [false, true]) {
    const h = harness(); h.controller.begin(request());
    if (alreadyPushed) await h.cover();
    h.controller.expedite(); h.controller.expedite();
    await flush();
    assert.equal(h.count("push"), 1);
    assert.equal(h.controller.phase, "idle");
    assert.equal(h.timers.size + h.paints.size, 0);
    assert.ok(h.animations.every(animation => animation.cancelled));
    h.controller.cancel();
  }
});

test("3000ms watchdog replaces uncommitted home with non-blocking loading, never an endless shield", async () => {
  const h = harness(); h.controller.begin(request()); await h.cover();
  assert.equal([...h.timers][0].delay, 3000);
  h.deadline(); await flush();
  assert.equal(h.controller.phase, "idle");
  assert.equal(h.pending, true);
  assert.equal(h.count("push"), 1);
  assert.equal(h.count("focus"), 0);
  h.controller.route("/decouvrir");
  assert.equal(h.pending, false, "the real route/loading UI replaces the bridge");
  h.controller.ready("/decouvrir"); h.paint();
  assert.equal(h.count("focus"), 1, "slow hydration still gets destination focus");
  assert.equal(h.animations.length, 1, "no late replay after the watchdog");
});

test("returning home or navigating elsewhere cancels pending hydration focus", async () => {
  for (const interrupt of [h => h.controller.cancel(), h => h.controller.route("/conditions"), h => { h.controller.route("/decouvrir"); h.controller.route("/"); }]) {
    const h = harness(); h.controller.begin(request()); await h.cover(); h.deadline();
    interrupt(h); h.controller.ready("/decouvrir"); h.controller.route("/decouvrir"); h.paint();
    assert.equal(h.count("focus"), 0);
    assert.equal(h.pending, false);
  }
});

test("setup failure yields the original link; push / animation failures clean up", async () => {
  const setup = harness({ prepare: () => { throw Error("unsupported"); } });
  assert.equal(setup.controller.begin(request()), false);
  assert.equal(setup.controller.phase, "idle");
  assert.equal(setup.count("push"), 0);
  const push = harness({ push: () => { throw Error("router unavailable"); } });
  push.controller.begin(request()); await push.cover();
  assert.equal(push.controller.phase, "idle");
  assert.equal(push.pending, false);
  assert.equal(push.timers.size, 0);
  const animation = harness(); animation.controller.begin(request());
  animation.animations[0].reject(Error("animation failed")); await flush();
  assert.equal(animation.controller.phase, "idle");
  assert.equal(animation.count("push"), 1);
  animation.controller.cancel();
});

test("history while reveal is queued prevents both animation and delayed focus", async () => {
  const h = harness(); h.controller.begin(request()); await h.cover();
  h.controller.route("/decouvrir"); h.controller.ready("/decouvrir");
  assert.equal(h.paints.size, 1);
  h.controller.cancel(); h.controller.route("/"); h.paint(); await flush();
  assert.equal(h.animations.length, 1);
  assert.equal(h.count("focus"), 0);
  assert.equal(h.controller.phase, "idle");
});

test("deadline during a reveal completes the matching destination, not the old home", async () => {
  const h = harness(); h.controller.begin(request()); await h.cover();
  h.controller.route("/experience"); // unexpected navigation cancels, even after push
  h.controller.ready("/decouvrir"); h.deadline(); h.paint();
  assert.equal(h.count("focus"), 0);
  assert.equal(h.pending, false);
  const next = harness(); next.controller.begin(request()); await next.cover();
  next.controller.route("/decouvrir"); next.controller.ready("/decouvrir"); next.paint();
  next.deadline(); await flush();
  assert.equal(next.controller.phase, "idle");
  assert.equal(next.count("focus"), 1);
  assert.equal(next.pending, false);
});

test("destination focus preserves Next/user focus, scroll and the original tab order", () => {
  for (const activeKind of ["body", "source", "removed", "header", "input", "next-heading"]) {
    for (const original of [null, "-1", "0"]) {
      const attributes = new Map(original === null ? [] : [["tabindex", original]]);
      const focuses = [];
      let blur;
      const target = {
        getClientRects: () => [{}],
        getAttribute: key => attributes.get(key) ?? null,
        setAttribute: (key, value) => attributes.set(key, value),
        removeAttribute: key => {
          attributes.delete(key);
          if (document.activeElement === target) document.activeElement = body;
        },
        addEventListener: (event, callback, options) => {
          assert.equal(event, "blur"); assert.deepEqual(options, { once: true }); blur = callback;
        },
        focus: options => { assert.equal(attributes.get("tabindex"), original ?? "-1"); focuses.push(options); document.activeElement = target; },
      };
      const body = { isConnected: true }, source = { isConnected: true };
      const activeElement = activeKind === "body" ? body : activeKind === "source" ? source : { isConnected: activeKind !== "removed" };
      const cachedHeading = { getClientRects: () => [], focus: () => assert.fail("hidden cached route must not receive focus") };
      const main = { querySelector: () => ({}), querySelectorAll: () => [cachedHeading, target] };
      const document = { body, activeElement, getElementById: () => main };
      transition.focusDoorDestination(document, source, "/decouvrir");
      const shouldFocus = ["body", "source", "removed"].includes(activeKind);
      assert.deepEqual(focuses, shouldFocus ? [{ preventScroll: true }] : []);
      assert.equal(document.activeElement, shouldFocus ? target : activeElement);
      assert.equal(attributes.get("tabindex") ?? null, shouldFocus ? original ?? "-1" : original);
      document.activeElement = body;
      blur?.();
      assert.equal(attributes.get("tabindex") ?? null, original);
    }
  }
  transition.focusDoorDestination({ getElementById: () => null }, null, "/decouvrir");
  transition.focusDoorDestination({ getElementById: () => ({ querySelector: () => null }) }, null, "/experience");
});

test("coverage geometry reaches every viewport corner on phones, desktops and offscreen origins", () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900], [2560, 1440]]) {
    for (const [x, y] of [[0, 0], [width, height], [width * .33, height * .46], [-20, height + 20]]) {
      const geometry = cellGeometry(x, y, width, height);
      for (const corner of [[0, 0], [width, 0], [0, height], [width, height]]) {
        assert.ok(Math.hypot(corner[0] - geometry.x, corner[1] - geometry.y) < geometry.radius * .7);
      }
    }
  }
  assert.equal(doorTiming.cover, 1000);
  assert.equal(doorTiming.reveal, 1400);
  assert.ok(doorTiming.deadline >= doorTiming.cover + doorTiming.reveal + 500);
  assert.ok(doorTiming.deadline <= 3000);
  assert.ok(read("../components/door-transition.tsx").includes('easing: "cubic-bezier(.45,0,.25,1)"'));
});

function load(file, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(read(file), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, ...globals, require(name) {
    if (name === "react/jsx-runtime") return jsx;
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
function loadLink(context, anchor = {}) {
  const NativeLink = ({ children, ...props }) => { delete props.onNavigate; return React.createElement("a", props, children); };
  return load("../components/door-transition.tsx", {
    react: { ...React, useContext: () => context, useRef: () => ({ current: anchor }) },
    "react-dom": { createPortal: () => null },
    "next/link": { default: NativeLink }, "next/navigation": {},
    "@/lib/door-transition": transition, "./door-transition.css": {},
  }).DoorLink;
}

test("DoorLink retains semantic href/labels/prefetch and only cancels owned onNavigate events", () => {
  for (const owned of [false, true]) {
    const calls = [], anchor = {};
    const DoorLink = loadLink({ begin: (...args) => { calls.push(args); return owned; } }, anchor);
    const node = DoorLink({ href: "/experience", character: "noir", "aria-label": "Noir", "aria-describedby": "invitation", children: "Enter" });
    assert.equal(node.props.href, "/experience");
    assert.equal(node.props.prefetch, undefined, "Next automatic prefetch remains enabled");
    assert.equal(node.props.onClick, undefined);
    assert.equal(node.props.onKeyDown, undefined);
    let prevented = 0;
    node.props.onNavigate({ preventDefault() { prevented++; } });
    assert.equal(prevented, Number(owned));
    assert.deepEqual(calls[0], ["/experience", "noir", anchor]);
    const html = renderToStaticMarkup(node);
    assert.match(html, /href="\/experience"/);
    assert.match(html, /aria-label="Noir"/);
    assert.match(html, /aria-describedby="invitation"/);
    assert.doesNotMatch(html, /character=|disabled|role="button"/);
  }
  const LinkWithoutScope = loadLink(null);
  const native = LinkWithoutScope({ href: "/decouvrir", character: "ciel", target: "_blank", download: "nexo" });
  assert.equal(native.props.target, "_blank");
  assert.equal(native.props.download, "nexo");
  native.props.onNavigate({ preventDefault() { assert.fail("no scope must remain native"); } });
});

test("installed Next Link preserves modifiers, middle-click, new tabs, downloads and Enter", () => {
  // Exercise the actual bundled guards used by DoorLink, not a recreation of them.
  const source = read("../node_modules/next/dist/client/app-dir/link.js");
  const functions = source.slice(source.indexOf("function isModifiedEvent"), source.indexOf("function formatStringOrUrl"));
  let owned = 0, navigated = 0;
  const context = { window: {}, _islocalurl: { isLocalURL: () => true }, _routerreducertypes: { ScrollBehavior: { Default: 0 } }, require: () => ({ navigate: () => navigated++ }) };
  vm.createContext(context); vm.runInContext(functions, context);
  function click(options = {}) {
    let prevented = 0;
    const { target = null, download = false, ...rest } = options;
    context.linkClicked({ currentTarget: { nodeName: "A", getAttribute: () => target, hasAttribute: () => download }, preventDefault: () => prevented++, ...rest }, "/decouvrir", { current: null }, false, undefined, event => { owned++; event.preventDefault(); });
    return prevented;
  }
  for (const value of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { nativeEvent: { which: 2 } }, { target: "_blank" }, { download: true }]) assert.equal(click(value), 0);
  assert.equal(owned, 0);
  assert.equal(click({ detail: 0 }), 1, "Enter's synthesized click reaches onNavigate");
  assert.equal(owned, 1); assert.equal(navigated, 0);
});

test("integration confines readiness, styles and listeners to the entrance transition", () => {
  const component = read("../components/door-transition.tsx");
  const provider = read("../components/landing-provider.tsx");
  const css = read("../components/door-transition.css");
  assert.match(provider, /<DoorTransitionScope locale=\{locale\}>/);
  assert.match(provider, /isDiscovery && <DiscoveryNavigation/);
  for (const route of ["decouvrir", "experience"]) assert.match(read(`../app/${route}/page.tsx`), new RegExp(`DoorRouteReady path="/${route}"`));
  assert.match(read("../app/error.tsx"), /<DoorRouteReady/);
  assert.doesNotMatch(read("../app/loading.tsx"), /DoorRouteReady/);
  for (const event of ["popstate", "pagehide", "resize", "visibilitychange", "keydown", "click", "change"]) {
    assert.ok(component.includes(`addEventListener("${event}"`));
    assert.ok(component.includes(`removeEventListener("${event}"`));
  }
  assert.match(component, /focusDoorDestination\(document, source.current, href\)/);
  assert.match(component, /getBoundingClientRect\(\)/);
  assert.match(css, /data-phase="idle"[^\n]+display: none; pointer-events: none/);
  assert.match(css, /data-door-pending[^\n]+entrance-home \{ display: none/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(component, /fetch\(|postJson|localStorage|sessionStorage|document\.body\.style|\.inert\s*=/);
  assert.doesNotMatch(css, /\.avatar-frame|\.avatar-door|#[\da-f]{3,8}\b/);
});
