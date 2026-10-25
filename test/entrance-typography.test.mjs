import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { entranceLetterFlight, evaporationPores } from "../lib/entrance-motion.ts";
import {
  createEntranceBag, createEntranceSequence, entranceEntries, entranceExits,
  entrancePalettes, entrancePhraseLayout, entranceUnits, letterFamilies,
  phraseFamilies, supportsLetterFlight,
} from "../lib/entrance-copy.ts";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const atmosphere = source("../components/entrance-atmosphere.tsx");
const sceneSource = source("../components/entrance-scene.tsx");
const animationSource = source("../lib/entrance-animation.ts");
const css = source("../app/globals.css");

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test("48 original entries per locale: 32 encouragements and 16 structured remixes", () => {
  for (const entries of Object.values(entranceEntries)) {
    assert.equal(entries.length, 48);
    assert.equal(new Set(entries.map(entry => entry.id)).size, 48);
    assert.equal(new Set(entries.map(entry => JSON.stringify(entranceUnits(entry)))).size, 48);
    assert.equal(entries.filter(entry => entry.kind === "encouragement").length, 32);
    assert.equal(entries.filter(entry => entry.kind === "remix").length, 16);
    assert.ok(entries.filter(supportsLetterFlight).length >= 16);
    for (const entry of entries) {
      assert.ok(entry.before.trim());
      assert.ok(entranceUnits(entry).length <= 16, entry.id);
      assert.doesNotMatch(JSON.stringify(entry), /<|>|author|attribution|quote/i);
      if (entry.kind === "remix") {
        assert.ok(entry.struck && entry.replacement);
        assert.notEqual(entry.struck, entry.replacement);
        const roles = entranceUnits(entry).map(unit => unit.role);
        assert.ok(roles.indexOf("struck") < roles.indexOf("replacement"));
      }
    }
  }
  assert.deepEqual(entranceEntries.fr.map(entry => entry.id), entranceEntries.en.map(entry => entry.id));
  assert.deepEqual(entranceEntries.fr.slice(0, 3).map(entry => entry.before), ["Respire", "Ressens", "Sois toi"]);
  assert.deepEqual(entranceEntries.en.slice(0, 3).map(entry => entry.before), ["Breathe", "Feel", "Be yourself"]);
});

test("revised French phrases preserve complete readings across editorial replacements", () => {
  const readings = entranceEntries.fr.filter(entry => entry.kind === "remix").map(entry =>
    [entry.before, entry.replacement, entry.after].filter(Boolean).join(" "));
  assert.ok(readings.includes("Tu peux t’accorder une pause"));
  assert.ok(readings.includes("Offre-toi un moment de calme"));
  assert.ok(readings.includes("Entre deux tâches, prends une pause"));
  assert.ok(readings.includes("Tu peux changer de rythme sans te justifier"));
  assert.ok(entranceEntries.fr.some(entry => entry.before === "Un petit pas, c’est déjà un début"));
  assert.doesNotMatch(JSON.stringify(entranceEntries.fr), /Un petit élan suffit pour ici|une autre couleur de journée|Fais léger|Garde du jeu/);
});

test("English copy retains the French intent and complete editorial replacements", () => {
  const translations = new Map(entranceEntries.fr.map((entry, index) => [entry.before, entranceEntries.en[index].before]));
  for (const [fr, en] of [
    ["Souffle", "Take a breath"],
    ["Prends l’air", "Get some air"],
    ["À ton écoute", "Here to listen"],
    ["Tu as le droit de ralentir", "It’s okay to slow down"],
    ["Pas besoin de savoir quoi dire", "You don’t have to know what to say"],
    ["Viens comme tu es, avec ce que tu ressens", "Come as you are, however you feel"],
    ["Un moment pour toi, sans rien à prouver", "A moment for you, with nothing to prove"],
  ]) assert.equal(translations.get(fr), en);
  const remixes = entranceEntries.en.filter(entry => entry.kind === "remix");
  const reading = (entry, role) => [entry.before, entry[role], entry.after].filter(Boolean).join(" ");
  assert.deepEqual(remixes.map(entry => reading(entry, "replacement")), [
    "You can give yourself a break",
    "The next step needs curiosity",
    "Give yourself a moment of calm",
    "Moving forward also means listening to yourself",
    "To begin, bring your curiosity",
    "To move forward, aim for less pressure",
    "Give yourself permission to start again",
    "A good pace follows the present moment",
    "Between tasks, make time for a break",
    "Make room for what you want",
    "You can connect without a script",
    "Your rough draft deserves a second look",
    "You can take time to listen to yourself",
    "You can change your pace without having to explain yourself",
    "Take time to notice small steps forward",
    "Here, you can share your feelings",
  ]);
  assert.equal(reading(remixes[2], "struck"), "Give yourself another challenge");
  assert.equal(reading(remixes[8], "struck"), "Between tasks, make time for getting ahead");
  assert.equal(reading(remixes[13], "struck"), "You can change your plans without having to explain yourself");
});

test("shuffle visits every entry before repeating, without repeats across refill seams", () => {
  for (let seed = 0; seed < 32; seed++) {
    for (const locale of ["fr", "en"]) {
      const next = createEntranceSequence(locale, seeded(seed));
      const scenes = Array.from({ length: 48 * 4 }, next);
      for (let start = 0; start < scenes.length; start += 48) {
        assert.equal(new Set(scenes.slice(start, start + 48).map(scene => scene.entry.id)).size, 48);
        assert.deepEqual(new Set(scenes.slice(start, start + 48).map(scene => scene.family)), new Set([...letterFamilies, ...phraseFamilies]));
      }
      scenes.forEach((scene, index) => {
        assert.equal(scene.serial, index);
        assert.ok(scene.variation >= 0 && scene.variation < 3);
        assert.equal(letterFamilies.includes(scene.family), supportsLetterFlight(scene.entry));
        if (!index) return;
        const previous = scenes[index - 1];
        assert.notEqual(scene.entry.id, previous.entry.id);
        assert.notEqual(scene.family, previous.family);
        assert.notEqual(scene.palette, previous.palette);
        assert.notEqual(scene.exit, previous.exit);
      });
      assert.deepEqual(new Set(scenes.map(scene => scene.palette)), new Set(entrancePalettes));
      assert.deepEqual(new Set(scenes.map(scene => scene.exit)), new Set(entranceExits));
      assert.equal(new Set(scenes.map(scene => scene.reverse)).size, 2);
      assert.equal(new Set(scenes.map(scene => scene.variation)).size, 3);
    }
  }
});

test("bags are bounded and support singleton inputs and deterministic random sources", () => {
  assert.throws(() => createEntranceBag([]));
  const one = createEntranceBag(["only"]);
  assert.equal(one(), "only");
  assert.equal(one(), "only");
  for (const random of [() => 0, () => 0.999999]) {
    const next = createEntranceBag([0, 1, 2], random);
    const values = Array.from({ length: 30 }, () => next());
    for (let i = 0; i < values.length; i += 3) assert.equal(new Set(values.slice(i, i + 3)).size, 3);
    for (let i = 1; i < values.length; i++) assert.notEqual(values[i], values[i - 1]);
  }
});

test("font-measured phrase rows stay inside the canvas; stair words descend by 22 units", () => {
  for (const entries of Object.values(entranceEntries)) {
    for (const entry of entries) {
      // Conservative mock glyph widths: actual browser layout uses getBBox().
      const widths = entranceUnits(entry).map(unit => unit.text.length * 28);
      for (const stairs of [false, true]) {
        const positions = entrancePhraseLayout(widths, stairs);
        positions.forEach((point, index) => {
          assert.ok(point.x >= 100 && point.x + widths[index] <= 1100, entry.id);
          assert.ok(point.y >= 80 && point.y <= 485, entry.id);
          assert.ok(point.step < (stairs ? 3 : 17));
          if (stairs && point.step > 0) assert.equal(point.y - positions[index - 1].y, 22);
        });
      }
    }
  }
  assert.deepEqual(entrancePhraseLayout([], true), []);
});

// Exercise the real animation builder using an in-memory TS module and measured
// SVG stand-ins. No Next build, browser server, or additional test dependency.
const moduleCode = ts.transpileModule(animationSource.replaceAll(/"@\/lib\/(entrance-[^"]+)"/g, (_, name) => JSON.stringify(new URL(`../lib/${name}.ts`, import.meta.url).href)), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { animateEntranceLetters, animateEntrancePhrase } = await import(`data:text/javascript;base64,${Buffer.from(moduleCode).toString("base64")}`);

function phraseStage(entry, family) {
  const content = entranceUnits(entry);
  const units = content.map(unit => {
    const selectors = new Map([
      ["[data-unit-text]", { getBBox: () => ({ x: 0, y: -36, width: unit.text.length * 25, height: 46 }) }],
      ["[data-type-reveal]", {}],
    ]);
    if (unit.role === "struck") selectors.set("[data-type-strike]", {});
    if (family === "stamp") selectors.set("[data-stamp-paper]", {});
    if (family === "wall") { selectors.set("[data-wall-outline]", {}); selectors.set("[data-wall-pen]", {}); }
    return { querySelector: selector => selectors.get(selector) ?? null };
  });
  const rails = family === "stairs" ? units.map(() => ({})) : [];
  return {
    units, rails,
    querySelectorAll: selector => selector === "[data-type-unit]" ? units : rails,
    querySelector: () => null,
  };
}

function recordingTimeline() {
  const operations = [];
  return {
    operations,
    duration() {
      return Math.max(0, ...operations.map(({ at, vars, target }) => at + (vars.duration ?? 0) + (vars.stagger ?? 0) * Math.max(0, (target.length ?? 1) - 1)));
    },
    set(target, vars, at) { operations.push({ kind: "set", target, vars, at }); return this; },
    to(target, vars, at) { operations.push({ kind: "to", target, vars, at }); return this; },
    fromTo(target, from, vars, at) { operations.push({ kind: "fromTo", target, vars, at, from }); return this; },
  };
}

test("every phrase/family/exit builds bounded choreography with readable replacements", () => {
  for (const entries of Object.values(entranceEntries)) {
    for (const entry of entries.filter(entry => !supportsLetterFlight(entry))) {
      for (const family of phraseFamilies) {
        for (const exit of entranceExits) {
          for (const reverse of [false, true]) {
            const stage = phraseStage(entry, family);
            const timeline = recordingTimeline();
            animateEntrancePhrase(timeline, stage, { entry, family, exit, reverse, variation: 2, palette: "sky", serial: 0 });
            assert.ok(timeline.operations.length < 320);
            const lastExit = Math.max(...timeline.operations.filter(operation => operation.kind === "to").map(operation => operation.at + operation.vars.duration));
            assert.equal(timeline.operations.at(-1).at, lastExit, `${entry.id}/${family}/${exit}: no empty tail`);
            assert.equal(timeline.duration(), lastExit);
            for (const operation of timeline.operations) {
              assert.ok(operation.target, `${entry.id} ${family}: missing SVG target`);
              assert.ok(Number.isFinite(operation.at));
              const end = operation.at + (operation.vars.duration ?? 0);
              assert.ok(end <= lastExit);
              if (operation.vars.duration) assert.ok(end < 12, `${family}/${exit}: bounded exit`);
            }
            entranceUnits(entry).forEach((unit, index) => {
              if (unit.role !== "replacement") return;
              const unitOperations = timeline.operations.filter(operation => operation.target === stage.units[index]);
              const visible = unitOperations.find(operation => operation.vars.opacity === 1);
              assert.ok(visible.at >= 3.35, "replacement follows the strike");
              assert.ok(visible.at + (visible.vars.duration ?? 0) < 6, "time to read before exit at 8.5s");
            });
          }
        }
      }
    }
  }
});

test("every FR/EN letter scene completes at its last exit, including short words and evaporation", () => {
  for (const entries of Object.values(entranceEntries)) {
    for (const entry of entries.filter(supportsLetterFlight)) {
      for (const variant of letterFamilies) {
        for (const reverse of [false, true]) {
          const characters = Array.from(entry.before).map(character => {
            const nodes = new Map([
              ["[data-letter-shape]", {}], ["[data-letter-ink]", {}],
              ["mask", variant === "evaporate" ? { id: "mask" } : null],
            ]);
            const flight = {
              querySelector: selector => nodes.get(selector),
              querySelectorAll: () => variant === "evaporate" ? evaporationPores.map(() => ({})) : [],
            };
            return {
              getComputedTextLength: () => 100,
              getBBox: () => ({ x: 0, y: -180, width: 90, height: 200 }),
              closest: () => character === " " ? null : flight,
            };
          });
          const word = { querySelectorAll: () => characters };
          const timeline = recordingTimeline();
          const cue = { variant, reverse };
          animateEntranceLetters(timeline, word, cue);
          const count = characters.filter(character => character.closest()).length;
          const lastExit = Math.max(...Array.from({ length: count }, (_, index) => entranceLetterFlight(index, count, cue).endAt));
          assert.ok(Math.abs(timeline.duration() - lastExit) < 1e-9, `${entry.before}/${variant}: no empty tail`);
          assert.equal(timeline.operations.at(-1).target, word);
          assert.ok(Math.abs(timeline.operations.at(-1).at - lastExit) < 1e-9);
        }
      }
    }
  }
});

test("families use distinct paper impacts, three descending steps, and refined outline reveals", () => {
  const entry = entranceEntries.fr[20];
  const timelines = Object.fromEntries(phraseFamilies.map(family => {
    const stage = phraseStage(entry, family);
    const timeline = recordingTimeline();
    animateEntrancePhrase(timeline, stage, { entry, family, exit: "erase", reverse: false, variation: 0, palette: "sage", serial: 0 });
    return [family, { stage, timeline }];
  }));
  assert.ok(timelines.stamp.timeline.operations.some(op => op.vars.scale === 1.65));
  const stairs = timelines.stairs;
  const landings = stairs.timeline.operations.filter(op => op.target === stairs.stage.units[0] && op.kind === "to" && "y" in op.vars);
  assert.equal(landings.length, 3);
  assert.equal(landings[1].vars.y - landings[0].vars.y, 22);
  assert.equal(landings[2].vars.y - landings[1].vars.y, 22);
  assert.ok(timelines.wall.timeline.operations.some(op => op.vars.strokeDashoffset === 360));
  assert.ok(timelines.wall.timeline.operations.some(op => op.vars.fillOpacity === 1));
  assert.doesNotMatch(animationSource + sceneSource, /setTimeout|setInterval|requestAnimationFrame|createElement|cloneNode|innerHTML|feTurbulence|splatter/);
});

test("one scene owns one timeline, optional masks, cleanup, and reduced-motion gating", () => {
  assert.match(atmosphere, /aria-hidden="true"/);
  assert.match(atmosphere, /!reducedMotion && <AnimatedEntranceScene key=\{locale\}/);
  assert.match(atmosphere, /pausedRef\.current = !pausedRef\.current/);
  assert.match(sceneSource, /Promise\.all\(\[import\("gsap"\), document\.fonts\.ready\]\)/);
  assert.match(sceneSource, /if \(cancelled\) return/);
  assert.match(sceneSource, /playback\.current\?\.dispose\(\)/);
  assert.match(sceneSource, /context\.revert\(\)/);
  assert.match(sceneSource, /bindEntrancePlayback\(timeline, document, paused\.current\)/);
  assert.match(sceneSource, /key=\{scene.serial\}/);
  assert.equal((sceneSource.match(/engine\.timeline\(/g) ?? []).length, 1);
  assert.match(sceneSource, /scene\.family === "evaporate" && <defs>/);
  assert.doesNotMatch(sceneSource + atmosphere, /aria-live|role="status"|dangerouslySetInnerHTML|style=|repeat: -1/);
  assert.match(css, /\.entrance-atmosphere \{[^}]*z-index: 0;[^}]*pointer-events: none;/);
  assert.match(css, /\.entrance-canvas\[data-composition="phrase"\] \{ width: 100%; \}/);
  assert.match(css, /\.entrance-atmosphere, \.entrance-motion-control \{ display: none; \}/);
  const additions = css.slice(css.indexOf("/* Phrase scenes"), css.indexOf(".entrance-evaporation-mask"));
  assert.doesNotMatch(additions, /#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(sceneSource + animationSource + css, /Remix original · Nexo|Original remix · Nexo|data-remix-label|entrance-remix-label/);
});
