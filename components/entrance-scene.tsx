import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { entranceEntries, entranceUnits, createEntranceSequence } from "@/lib/entrance-copy";
import type { EntranceScene } from "@/lib/entrance-copy";
import { animateEntranceLetters, animateEntrancePhrase } from "@/lib/entrance-animation";
import { bindEntrancePlayback, evaporationPores } from "@/lib/entrance-motion";
import type { EntranceVariant } from "@/lib/entrance-motion";
import type { Locale } from "@/lib/landing-api";

type EntranceSceneProps = {
  locale: Locale;
  paused: RefObject<boolean>;
  playback: RefObject<ReturnType<typeof bindEntrancePlayback> | null>;
  onReady: (ready: boolean) => void;
};

// Mounted only when motion is allowed. The locale key disposes the previous scene.
export function AnimatedEntranceScene({ locale, paused, playback, onReady }: EntranceSceneProps) {
  const root = useRef<SVGSVGElement>(null);
  const next = useRef<ReturnType<typeof createEntranceSequence> | null>(null);
  const [engine, setEngine] = useState<typeof import("gsap").gsap | null>(null);
  const [scene, setScene] = useState<EntranceScene>(() => ({
    entry: entranceEntries[locale][0], family: "zoom", palette: "sky", exit: "lift", reverse: false, variation: 0, serial: -1,
  }));
  const id = useId().replace(/:/g, "");
  const letters = scene.family === "zoom" || scene.family === "lateral" || scene.family === "fold" || scene.family === "evaporate";

  useEffect(() => {
    let cancelled = false;
    // Fonts must be ready before measuring either glyphs or word advances.
    void Promise.all([import("gsap"), document.fonts.ready]).then(([{ gsap }]) => {
      if (cancelled) return;
      next.current = createEntranceSequence(locale);
      setScene(next.current());
      setEngine(gsap);
    }).catch(() => { if (!cancelled) onReady(false); });
    return () => { cancelled = true; next.current = null; };
  }, [locale, onReady]);

  useEffect(() => {
    if (!engine || !root.current) return;
    const scope = root.current;
    const context = engine.context(() => {}, scope);
    try {
      context.add(() => {
        const timeline = engine.timeline({ paused: true, onComplete: () => {
          if (next.current) setScene(next.current());
        } });
        const stage = scope.querySelector<SVGGElement>("[data-entrance-scene]")!;
        if (letters) animateEntranceLetters(timeline, stage, { reverse: scene.reverse, variant: scene.family as EntranceVariant });
        else animateEntrancePhrase(timeline, stage, scene);
        playback.current = bindEntrancePlayback(timeline, document, paused.current);
      });
      onReady(true);
    } catch {
      // A font/SVG/animation failure must never take down the entrance links.
      context.revert();
      onReady(false);
    }
    return () => {
      playback.current?.dispose();
      playback.current = null;
      context.revert();
    };
  }, [engine, letters, onReady, paused, playback, scene]);

  return <svg ref={root} className="entrance-canvas" data-composition={letters ? "letters" : "phrase"} viewBox="0 0 1200 600" focusable="false">
    <g key={scene.serial} data-entrance-scene="" data-entry={scene.entry.id} data-family={scene.family} data-exit={scene.exit} data-palette={scene.palette} data-variation={scene.variation} data-word="" data-long={scene.entry.before.length > 8} opacity="0">
      {letters ? Array.from(scene.entry.before).map((character, index) => {
        if (character === " ") return <text key={index} data-character="" className="entrance-letter" xmlSpace="preserve" opacity="0">{character}</text>;
        const maskId = `entrance-evaporation-${id}-${scene.serial}-${index}`;
        return <g key={index} data-letter-flight="" opacity="0">
          {scene.family === "evaporate" && <defs>
            <mask id={maskId} maskContentUnits="objectBoundingBox" className="entrance-evaporation-mask">
              <rect width="1" height="1" className="entrance-mask-paper" />
              {evaporationPores.map((pore, poreIndex) => <ellipse key={poreIndex} data-evaporation-pore="" cx={pore.cx} cy={pore.cy} rx="0" ry="0" />)}
            </mask>
          </defs>}
          <g data-letter-shape=""><g data-letter-ink=""><text data-character="" className="entrance-letter" x="0" y="370">{character}</text></g></g>
        </g>;
      }) : <>
        {scene.family === "stairs" && entranceUnits(scene.entry).map((_, index) => <path key={index} data-stair-rail="" className="entrance-stair-rail" pathLength="1" d="M0 0" />)}
        {entranceUnits(scene.entry).map((unit, index) => {
          const clipId = `entrance-reveal-${id}-${scene.serial}-${index}`;
          return <g key={index} data-type-unit="" data-role={unit.role} data-tone={(index + scene.variation) % 3} opacity="0">
            <defs><clipPath id={clipId}><rect data-type-reveal="" /></clipPath></defs>
            <g clipPath={`url(#${clipId})`}>
              {scene.family === "stamp" && <rect data-stamp-paper="" className="entrance-stamp-paper" rx="3" />}
              {scene.family === "wall" && <text data-wall-outline="" className="entrance-phrase-text entrance-wall-outline">{unit.text}</text>}
              <text data-unit-text="" className="entrance-phrase-text">{unit.text}</text>
              {unit.role === "struck" && <line data-type-strike="" className="entrance-type-strike" pathLength="1" />}
            </g>
            {scene.family === "wall" && <line data-wall-pen="" className="entrance-wall-pen" />}
          </g>;
        })}
      </>}
    </g>
  </svg>;
}
