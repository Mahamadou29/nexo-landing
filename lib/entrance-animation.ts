import type { gsap as Gsap } from "gsap";
import { entranceLetterFlight, entranceLetterPositions, entranceOffscreenX, entranceTiming, evaporationPores } from "@/lib/entrance-motion";
import type { EntranceCue } from "@/lib/entrance-motion";
import { entrancePhraseLayout, entranceUnits } from "@/lib/entrance-copy";
import type { EntranceScene } from "@/lib/entrance-copy";

type Timeline = ReturnType<typeof Gsap.timeline>;

// The original independent glyph flights: no word-level stand-in for the zoom.
export function animateEntranceLetters(timeline: Timeline, word: SVGGElement, cue: EntranceCue) {
  const start = 0;
  const timing = entranceTiming;
  const characters = Array.from(word.querySelectorAll<SVGTextElement>("[data-character]"));
  const positions = entranceLetterPositions(characters.map(character => character.getComputedTextLength()));
  const letters = characters.flatMap((character, characterIndex) => {
    const flight = character.closest<SVGGElement>("[data-letter-flight]");
    if (!flight) return [];
    const box = character.getBBox();
    return [{ flight, x: positions[characterIndex], width: box.width, height: box.height, cx: box.x + box.width / 2, cy: box.y + box.height / 2 }];
  });
  timeline
    .set(word, { opacity: 0 }, start)
    .set(word, { opacity: 1 }, start);

  letters.forEach(({ flight, x, width, height, cx, cy }, letterIndex) => {
    const glyph = flight.querySelector<SVGGElement>("[data-letter-shape]")!;
    const ink = flight.querySelector<SVGGElement>("[data-letter-ink]")!;
    const mask = flight.querySelector<SVGMaskElement>("mask");
    const pores = flight.querySelectorAll<SVGEllipseElement>("[data-evaporation-pore]");
    const plan = entranceLetterFlight(letterIndex, letters.length, cue);
    const enter = start + plan.enterAt;
    const launch = start + plan.at;
    const end = start + plan.endAt;
    const foldX = plan.foldVertical ? 0.012 : 1.08;
    const foldY = plan.foldVertical ? 1.08 : 0.012;
    const entry = {
      zoom: { x: x + (cue.reverse ? -1 : 1) * (650 + letterIndex * 40), y: plan.direction * 160, scaleX: 0.18, scaleY: 0.18, rotation: -plan.rotation, skewY: 0 },
      lateral: { x: x - plan.direction * 90, y: plan.direction * 260, scaleX: 1, scaleY: 1, rotation: plan.direction * 18, skewY: 0 },
      fold: { x, y: 0, scaleX: foldX, scaleY: foldY, rotation: 0, skewY: plan.direction * 28 },
      evaporate: { x, y: 45, scaleX: 0.96, scaleY: 0.96, rotation: 0, skewY: 0 },
    }[cue.variant];

    timeline
      .set(flight, { x: entry.x, y: entry.y, opacity: 0 }, start)
      .set(glyph, { scaleX: entry.scaleX, scaleY: entry.scaleY, rotation: entry.rotation, skewY: entry.skewY, svgOrigin: `${cx} ${cy}` }, start)
      // A mask is attached only during evaporation, never during a giant zoom.
      .set(ink, { attr: { mask: cue.variant === "evaporate" && mask ? `url(#${mask.id})` : "none" } }, start)
      .to(flight, { x, y: 0, opacity: 1, duration: plan.enterDuration, ease: cue.variant === "evaporate" ? "sine.inOut" : "power3.out" }, enter)
      .to(glyph, { scaleX: 1, scaleY: 1, rotation: 0, skewY: 0, duration: plan.enterDuration, ease: "power3.out" }, enter);
    if (pores.length) timeline.set(pores, { attr: { rx: 0, ry: 0 } }, start);

    switch (cue.variant) {
      case "zoom": {
        const approach = plan.duration * 0.65;
        timeline
          .to(flight, { x: plan.focusX - cx, y: plan.focusY - cy, duration: approach, ease: "power2.in" }, launch)
          .to(glyph, { scale: plan.scale, rotation: plan.rotation, duration: plan.duration, ease: "power2.in" }, launch)
          // Pass the camera off-axis: still solid, still growing, no dissolve.
          .to(flight, { x: entranceOffscreenX(width, height, plan.scale, plan.direction) - cx, y: plan.exitY, duration: plan.duration - approach, ease: "power2.in" }, launch + approach);
        break;
      }
      case "lateral": {
        const gather = plan.duration * 0.28;
        timeline
          .to(flight, { x: x - plan.direction * 65, y: plan.arcY, duration: gather, ease: "sine.inOut" }, launch)
          .to(flight, { x: entranceOffscreenX(width, height, 1, plan.direction) - cx, y: plan.exitY, duration: plan.duration - gather, ease: "power2.in" }, launch + gather)
          .to(glyph, { rotation: plan.direction * (35 + letterIndex % 3 * 20), duration: plan.duration, ease: "power1.in" }, launch);
        break;
      }
      case "fold": {
        const crease = plan.duration - 0.55;
        timeline
          .to(flight, { x: x + plan.direction * 28, y: -18, duration: crease, ease: "sine.inOut" }, launch)
          .to(glyph, { scaleX: foldX, scaleY: foldY, skewY: plan.direction * 32, duration: crease, ease: "power2.inOut" }, launch)
          // Edge-on strokes contract to nothing; no alpha dissolve.
          .to(glyph, { scaleX: 0, scaleY: 0, duration: 0.55, ease: "power2.in" }, end - 0.55);
        break;
      }
      case "evaporate":
        timeline
          .to(flight, { x: x + plan.direction * 40, y: -95 - letterIndex % 3 * 20, duration: plan.duration, ease: "sine.inOut" }, launch)
          .to(pores, {
            attr: {
              rx: (poreIndex: number) => evaporationPores[poreIndex].rx,
              ry: (poreIndex: number) => evaporationPores[poreIndex].ry,
            },
            duration: timing.evaporationDuration,
            stagger: timing.poreStagger,
            ease: "power2.inOut",
          }, launch + timing.evaporationDelay);
        break;
    }
    // Bookkeeping only: geometry has already left, collapsed, or evaporated.
    timeline.set(flight, { opacity: 0 }, end);
  });

  // Finish with the last exit, not a fixed slot that leaves the canvas empty.
  timeline.set(word, { opacity: 0 }, timeline.duration());
}

// One measured phrase, one timeline. No particles, animated filters, or DOM clones.
export function animateEntrancePhrase(timeline: Timeline, stage: SVGGElement, scene: EntranceScene) {
  const units = Array.from(stage.querySelectorAll<SVGGElement>("[data-type-unit]"));
  const content = entranceUnits(scene.entry);
  const boxes = units.map(unit => unit.querySelector<SVGTextElement>("[data-unit-text]")!.getBBox());
  const widths = boxes.map(box => box.width);
  const positions = entrancePhraseLayout(widths, scene.family === "stairs");
  const direction = scene.reverse ? -1 : 1;
  const rails = stage.querySelectorAll<SVGPathElement>("[data-stair-rail]");
  timeline.set(stage, { opacity: 1 }, 0);

  units.forEach((unit, index) => {
    const { x, y, step } = positions[index];
    const box = boxes[index];
    const paper = unit.querySelector("[data-stamp-paper]");
    const clip = unit.querySelector("[data-type-reveal]");
    const outline = unit.querySelector("[data-wall-outline]");
    const text = unit.querySelector("[data-unit-text]");
    const pen = unit.querySelector("[data-wall-pen]");
    const strike = unit.querySelector("[data-type-strike]");
    const rail = rails[index];
    const replacement = content[index].role === "replacement" || content[index].role === "after";
    const at = replacement ? 3.35 + index * 0.08 : 0.2 + index * 0.14;
    const tilt = ((index + scene.variation) % 3 - 1) * 5;
    const left = box.x - 12;
    const width = box.width + 24;
    const top = box.y - 10;
    const height = box.height + 20;

    timeline
      .set(unit, { x, y, opacity: 0, svgOrigin: `${box.width / 2} ${box.y + box.height / 2}` }, 0)
      .set(clip, { attr: { x: left, y: top, width, height } }, 0);
    if (paper) timeline.set(paper, { attr: { x: left, y: top, width, height } }, 0);
    if (strike) {
      timeline
        .set(strike, { attr: { x1: 0, x2: box.width, y1: -box.height * 0.36, y2: -box.height * 0.43 }, strokeDashoffset: 1 }, 0)
        .to(strike, { strokeDashoffset: 0, duration: 0.55, ease: "power2.inOut" }, 2.7)
        .to(text, { opacity: 0.48, duration: 0.55 }, 2.7);
    }

    switch (scene.family) {
      case "stamp":
        timeline
          .set(unit, { x: x + direction * (scene.variation === 1 ? 85 : 15), y: y - 90, rotation: tilt + direction * 12, scale: 1.65 }, 0)
          .to(unit, { x, y: y + 3, opacity: 1, rotation: tilt, scale: 0.94, duration: 0.32, ease: "power3.in" }, at)
          .to(unit, { y, scale: 1, duration: 0.24, ease: "back.out(2)" }, at + 0.32);
        break;
      case "stairs": {
        const next = positions[index + 1];
        const endX = x + box.width + 14;
        const connector = next && next.step > step ? ` H${next.x - 14} V${next.y + 13}` : "";
        timeline
          .set(rail, { attr: { d: `M${x - 14},${y + 13} H${endX}${connector}` }, strokeDashoffset: 1 }, 0)
          .to(rail, { strokeDashoffset: 0, duration: 0.45, ease: "power1.out" }, at)
          .set(unit, { x: x - direction * 81, y: y - 100, rotation: -direction * (5 + scene.variation * 3) }, 0)
          .to(unit, { x: x - direction * 54, y: y - 44, rotation: direction * 4, opacity: 1, duration: 0.24, ease: "power2.in" }, at + 0.12)
          .to(unit, { x: x - direction * 27, y: y - 22, rotation: -direction * 3, duration: 0.24, ease: "bounce.out" }, at + 0.36)
          .to(unit, { x, y, rotation: 0, duration: 0.3, ease: "bounce.out" }, at + 0.6);
        break;
      }
      case "wall":
        timeline
          .set(unit, { opacity: 1 }, at)
          .set(clip, { attr: { width: 0 } }, 0)
          .set(text, { fillOpacity: 0 }, 0)
          .set(outline, { strokeDashoffset: 360 }, 0)
          .set(pen, { attr: { x1: left, x2: left, y1: top, y2: top + height }, opacity: 0 }, 0)
          .to(clip, { attr: { width }, duration: 1.15, ease: "sine.inOut" }, at)
          .to(outline, { strokeDashoffset: 0, duration: 1.15, ease: "sine.out" }, at)
          .to(text, { fillOpacity: 1, duration: 0.85, ease: "sine.inOut" }, at + 0.45)
          .set(pen, { opacity: 0.65 }, at)
          .to(pen, { attr: { x1: left + width, x2: left + width }, duration: 1.15, ease: "sine.inOut" }, at)
          .set(pen, { opacity: 0 }, at + 1.15);
        break;
    }

    const out = 8.5 + (scene.reverse ? units.length - 1 - index : index) * 0.1;
    switch (scene.exit) {
      case "lift":
        timeline.to(unit, { x: x + direction * (80 + index * 15), y: -650, rotation: tilt + direction * 28, duration: 1.4, ease: "power2.in" }, out);
        break;
      case "peel":
        timeline.to(unit, { scaleX: 0.015, skewY: direction * 38, y: y - 30, duration: 0.75, ease: "power2.inOut" }, out)
          .to(unit, { scaleY: 0, duration: 0.35, ease: "power2.in" }, out + 0.75);
        break;
      case "slide":
        timeline.to(unit, { x: x + direction * 1800, y: y + (scene.family === "stairs" ? 500 : (index % 3 - 1) * 90), rotation: direction * scene.variation * 6, duration: 1.3, ease: "power3.in" }, out);
        break;
      case "erase":
        timeline.to(clip, { attr: { width: 0, x: scene.reverse ? left : left + width }, duration: 1.1, ease: "sine.inOut" }, out);
        break;
    }
    if (rail) timeline.to(rail, { strokeDashoffset: -1, duration: 0.8, ease: "sine.inOut" }, out);
  });

  timeline.set(stage, { opacity: 0 }, timeline.duration());
}
