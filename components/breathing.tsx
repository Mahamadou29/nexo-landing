"use client";

import Image from "next/image";
import { Info, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { bindBreathingLifecycle, BreathingSession, formatBreathingTime, initialBreathingState, type BreathingState } from "@/lib/breathing";
import { cn } from "@/lib/utils";
import "./breathing.css";

const copy = {
  fr: {
    title: "Une minute pour ralentir", ready: ["À ton", "rythme."], inhale: ["Inspire", "doucement."], exhale: ["Expire", "doucement."], complete: ["Un peu", "de calme."],
    idle: "Une minute, juste pour toi.", stopped: "La pause est arrêtée.", done: "Ta minute est terminée.", gentle: "Sans forcer.",
    start: "Commencer", stop: "Arrêter", restart: "Recommencer", remaining: "Temps restant", info: "À propos de cette respiration", close: "Fermer les informations",
    notice: "Inspire doucement 4 secondes, puis expire 6 secondes, sans retenir ton souffle. Ce guide est une invitation, pas un objectif : garde ton rythme naturel et arrête si tu ressens une gêne. Sans son, sans micro ni envoi. La séance s’arrête si tu quittes cet onglet.",
  },
  en: {
    title: "One minute to slow down", ready: ["At your", "pace."], inhale: ["Breathe in", "gently."], exhale: ["Breathe out", "gently."], complete: ["A little", "calm."],
    idle: "One minute, just for you.", stopped: "Your pause has stopped.", done: "Your minute is complete.", gentle: "No need to force it.",
    start: "Begin", stop: "Stop", restart: "Start again", remaining: "Time remaining", info: "About this breathing guide", close: "Close information",
    notice: "Breathe in gently for 4 seconds, then out for 6 seconds, without holding your breath. This guide is an invitation, not a goal: keep your natural rhythm and stop if you feel uncomfortable. No sound, microphone or sending. The session stops when you leave this tab.",
  },
} as const;

export function Breathing({ locale }: { locale: "fr" | "en" }) {
  return <BreathingMoment key={locale} locale={locale} />;
}

function BreathingMoment({ locale }: { locale: "fr" | "en" }) {
  const t = copy[locale];
  const id = useId();
  const session = useRef<BreathingSession | null>(null);
  const organic = useRef<SVGGElement | null>(null);
  const notice = useRef<HTMLDivElement | null>(null);
  const infoTrigger = useRef<HTMLButtonElement | null>(null);
  const [state, setState] = useState<BreathingState>(initialBreathingState);
  const active = state.status === "running";

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastExpansion = 0;
    const draw = () => {
      // SVG attributes keep visual frames out of React and share the exact session clock.
      const expansion = motion.matches ? 0.45 : lastExpansion;
      const scale = 0.69 + expansion * 1.51;
      organic.current?.setAttribute("transform", `translate(240 200) scale(${scale}) rotate(${-5 + expansion * 8}) translate(-240 -200)`);
      organic.current?.setAttribute("opacity", `${0.85 - expansion * 0.32}`);
    };
    const current = new BreathingSession(setState, frame => { lastExpansion = frame.expansion; draw(); });
    session.current = current;
    draw();
    motion.addEventListener("change", draw);
    const cleanup = bindBreathingLifecycle(current, document, window);
    return () => {
      cleanup();
      motion.removeEventListener("change", draw);
      session.current = null;
    };
  }, []);

  function toggle() {
    if (active) session.current?.stop();
    else if (document.visibilityState !== "hidden") session.current?.start();
  }

  const action = active ? "stop" : state.status === "idle" ? "start" : "restart";
  const phase = active ? t[state.phase] : state.status === "complete" ? t.complete : t.ready;
  const caption = active ? t.gentle : state.status === "stopped" ? t.stopped : state.status === "complete" ? t.done : t.idle;
  const inhale = !active || state.phase === "inhale";

  return <section data-breathing-ui data-state={state.status} data-phase={state.phase} lang={locale} aria-labelledby={`${id}-title`} className="mx-auto flex min-h-0 w-full min-w-0 max-w-5xl flex-col items-center gap-5 py-2 text-navy sm:gap-7">
    <h3 id={`${id}-title`} className="sr-only">{t.title}</h3>
    <div data-breathing-layout className="grid min-h-0 w-full min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-6">
      <div data-breathing-stage aria-hidden="true" className="relative isolate mx-auto grid aspect-[6/5] w-full max-w-56 place-items-center md:max-w-sm">
        <svg data-breathing-organic viewBox="0 0 480 400" focusable="false" className="pointer-events-none absolute inset-0 size-full">
          <defs><radialGradient id={`${id}-wash`} cx="35%" cy="30%" r="75%"><stop className="nexo-breath-light" /><stop offset="1" className="nexo-breath-sky" /></radialGradient></defs>
          <g ref={organic} transform="translate(240 200) scale(.69) rotate(-5) translate(-240 -200)">
            <path className="nexo-breath-aura" d="M36 181C22 96 112 27 194 44C260 58 292 19 357 61C432 109 466 170 426 244C393 302 366 351 289 355C206 359 163 387 99 330C48 283 46 242 36 181Z" />
            <path fill={`url(#${id}-wash)`} d="M65 182C53 112 125 62 194 76C250 86 292 48 346 90C405 133 433 188 397 248C365 300 331 328 271 327C203 328 166 352 115 306C77 270 72 235 65 182Z" />
          </g>
        </svg>
        <div data-breathing-companion className="relative size-32 select-none md:size-48">
          <Image src="/media/demo/ciel-inhale.webp" alt="" width={480} height={480} sizes="(min-width: 768px) 192px, 128px" loading="eager" draggable={false} className={cn("absolute inset-0 size-full object-contain transition-opacity duration-500 motion-reduce:transition-none", inhale ? "opacity-100" : "opacity-0")} />
          <Image src="/media/demo/ciel-exhale.webp" alt="" width={480} height={480} sizes="(min-width: 768px) 192px, 128px" loading="eager" draggable={false} className={cn("absolute inset-0 size-full object-contain transition-opacity duration-500 motion-reduce:transition-none", inhale ? "opacity-0" : "opacity-100")} />
        </div>
      </div>
      <div data-breathing-guide className="flex min-h-0 min-w-0 flex-col justify-center gap-4 text-center md:text-left">
        <p data-breathing-phase role="status" aria-live="polite" aria-atomic="true" className="text-[clamp(2.4rem,5.8vw,5rem)] leading-[1.08] font-extralight tracking-[-0.065em]">
          <span className="block">{phase[0]}</span><span className="block">{phase[1]}</span>
        </p>
        <p data-breathing-caption className="text-sm text-muted-foreground"><span>{caption}</span><span data-breathing-phase-time aria-hidden="true" className="ml-3 inline-block w-7 text-left tabular-nums">{active ? `${state.phaseSeconds} s` : "\u00a0"}</span></p>
      </div>
    </div>
    <div data-breathing-controls className="relative flex w-full shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6">
      <p data-breathing-clock role="timer" aria-live="off" aria-label={t.remaining} className="w-12 shrink-0 text-right text-3xl leading-none font-extralight tracking-tighter tabular-nums sm:w-20 sm:text-4xl">{formatBreathingTime(state.remainingSeconds)}</p>
      <Button data-breathing-toggle data-action={action} type="button" onClick={toggle} className={cn("min-h-11 w-44 shrink-0 rounded-full px-4 transition-colors motion-reduce:transition-none", action === "stop" ? "bg-destructive text-ivory hover:bg-destructive/90" : action === "restart" ? "bg-sky text-navy hover:bg-sky/80" : "bg-navy text-ivory hover:bg-navy/90")}>
        {action === "stop" ? <Square aria-hidden="true" /> : action === "restart" ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}{t[action]}
      </Button>
      <div data-breathing-info onKeyDown={event => {
        if (event.key === "Escape" && notice.current?.matches(":popover-open")) {
          event.preventDefault(); event.stopPropagation(); notice.current.hidePopover(); infoTrigger.current?.focus();
        }
      }}>
        <button ref={infoTrigger} type="button" popoverTarget={`${id}-notice`} aria-label={t.info} title={t.info} className="grid size-11 place-items-center rounded-full text-muted-foreground hover:text-navy focus-visible:ring-2 focus-visible:ring-ring"><Info aria-hidden="true" className="size-4" /></button>
        <div ref={notice} id={`${id}-notice`} data-breathing-notice popover="auto" className="rounded-2xl bg-ivory p-4 text-xs leading-relaxed text-muted-foreground shadow-lg shadow-navy/10">
          <p>{t.notice}</p>
          <button type="button" popoverTarget={`${id}-notice`} popoverTargetAction="hide" className="mt-2 min-h-11 text-navy underline underline-offset-4">{t.close}</button>
        </div>
      </div>
    </div>
  </section>;
}
