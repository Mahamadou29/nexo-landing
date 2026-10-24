import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../app/globals.css");
const mobile = css.slice(css.indexOf("/* Mobile uses a scrollable app shell"), css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
const provider = read("../components/landing-provider.tsx");
const experience = read("../components/experience.tsx");

test("mobile shell is scoped below desktop with safe areas and normal page scrolling", () => {
  assert.match(mobile, /@media \(max-width: 767px\)/);
  assert.match(mobile, /height: auto;[\s\S]*overflow: visible/);
  assert.match(mobile, /padding-bottom: calc\(88px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(mobile, /env\(safe-area-inset-top\)/);
  assert.match(mobile, /font-size: 16px; scroll-margin-block: 100px/);
  const layout = read("../app/layout.tsx");
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /interactiveWidget: "resizes-content"/);
  assert.doesNotMatch(layout, /userScalable: false|maximumScale: 1/);
});

test("mobile navigation uses real routes and existing experience handlers", () => {
  assert.match(provider, /pathname !== "\/experience" && <nav className="mobile-app-nav hidden"/);
  for (const href of ["/", "/decouvrir", "/experience"]) assert.ok(provider.includes(`{ href: "${href}", label:`));
  assert.match(provider, /aria-current=\{pathname === href \? "page" : undefined\}/);
  assert.match(experience, /<StepIcon step=\{target\} \/>/);
  assert.match(experience, /aria-current=\{step === target \? "step" : undefined\}/);
  assert.match(mobile, /:has\(:is\(input:not\(\[type="checkbox"\]\), textarea\):focus\)/);
});

test("mobile entrance has persistent door labels and does not mount hidden animations", () => {
  const doors = read("../components/doors.tsx");
  assert.match(doors, /mobile-door-copy/);
  assert.match(doors, /Prendre un instant/);
  assert.match(mobile, /\.entrance-home \.door-avatar-row \{[^}]+position: static/);
  assert.match(read("../components/entrance-atmosphere.tsx"), /const motionQuery = "\(prefers-reduced-motion: reduce\), \(max-width: 767px\)"/);
});

test("mobile mood action submits the same optional local-only form", () => {
  assert.match(experience, /onSubmit=\{event => \{ event.preventDefault\(\); releaseMood\(\); \}\}/);
  assert.match(experience, /step === "mood" && <div className="mobile-mood-actions/);
  assert.match(experience, /<Button type="submit" disabled=\{leaving\}/);
  assert.match(experience, /Continuer sans écrire/);
  assert.match(mobile, /\.experience-main \.mood-composer \{ position: relative; top: auto/);
});
