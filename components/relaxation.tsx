"use client";

import Image from "next/image";
import { Info, Play, Square, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelaxationTime, initialRelaxationState, relaxationPhrases, RelaxationSession, type RelaxationState } from "@/lib/relaxation";

const copy = {
  fr: {
    title: "Un peu de calme, pour toi.", remaining: "Temps restant", start: "Commencer avec le son", stop: "Arrêter", restart: "Recommencer avec le son", retry: "Réessayer avec le son", volume: "Volume", info: "À propos du son", startShort: "Commencer", restartShort: "Recommencer", retryShort: "Réessayer",
    notice: "Son doux créé sur ton appareil · sans micro ni envoi. Arrêt à 2 minutes ou si tu quittes cet onglet.",
    idle: "Installe-toi, à faible volume.", starting: "Le son s’installe…", playing: "Rien à faire. Juste être là.", stopping: "Le son s’éteint…", stopped: "La pause est arrêtée. Reviens quand tu veux.", complete: "Deux minutes pour toi. À ton rythme, la suite.", error: "Le son n’a pas pu continuer. Tu peux réessayer.",
  },
  en: {
    title: "A little calm, just for you.", remaining: "Time remaining", start: "Start with sound", stop: "Stop", restart: "Start again with sound", retry: "Retry with sound", volume: "Volume", info: "About the sound", startShort: "Begin", restartShort: "Start again", retryShort: "Try again",
    notice: "Gentle sound made on your device · no microphone or sending. Stops at 2 minutes or when you leave this tab.",
    idle: "Settle in, with the volume low.", starting: "The sound is settling in…", playing: "Nothing to do. Just be here.", stopping: "The sound is fading…", stopped: "Your pause has stopped. Come back when you like.", complete: "Two minutes for you. Take the next at your pace.", error: "The sound could not continue. You can try again.",
  },
};

export function Relaxation({ locale }: { locale: "fr" | "en" }) {
  // A locale change has the same cleanup boundary as leaving the activity.
  return <RelaxationMoment key={locale} locale={locale} />;
}

function RelaxationMoment({ locale }: { locale: "fr" | "en" }) {
  const t = copy[locale];
  const id = useId();
  const session = useRef<RelaxationSession | null>(null);
  const [state, setState] = useState<RelaxationState>(initialRelaxationState);
  const [volume, setVolume] = useState(20);
  const active = state.status === "starting" || state.status === "playing";
  useEffect(() => {
    const stopHidden = () => { if (document.visibilityState === "hidden") void session.current?.stop(true); };
    const stopPage = () => { void session.current?.stop(true); };
    document.addEventListener("visibilitychange", stopHidden);
    window.addEventListener("pagehide", stopPage);
    return () => {
      document.removeEventListener("visibilitychange", stopHidden);
      window.removeEventListener("pagehide", stopPage);
      void session.current?.dispose();
      session.current = null;
    };
  }, []);

  function toggle() {
    if (active) { void session.current?.stop(); return; }
    if (document.visibilityState === "hidden" || state.status === "stopping") return;
    if (!session.current) session.current = new RelaxationSession(setState);
    session.current.setVolume(volume);
    void session.current.start();
  }

  const action = active ? t.stop : state.status === "error" ? t.retry : state.status === "idle" ? t.start : t.restart;
  const toggleState = active || state.status === "stopping" ? "stop" : state.status === "idle" ? "start" : "restart";
  const shortAction = toggleState === "stop" ? t.stop : state.status === "error" ? t.retryShort : state.status === "idle" ? t.startShort : t.restartShort;
  return <section data-relaxation-ui data-state={state.status} lang={locale} aria-labelledby={`${id}-title`} className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center gap-5 py-2 text-navy sm:gap-7">
    <h3 id={`${id}-title`} className="sr-only">{t.title}</h3>
    <div className="grid w-full min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-6">
      <div data-relaxation-stage aria-hidden="true" className="relative isolate mx-auto grid aspect-[6/5] w-full max-w-52 place-items-center md:max-w-sm">
        <svg data-relaxation-waves aria-hidden="true" focusable="false" viewBox="0 0 480 400" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          {[0, 1, 2, 3].map(ripple => <path key={ripple} className="nexo-relax-wave" vectorEffect="non-scaling-stroke" d="M39 176C12 108 82 40 167 51C239 60 260 10 341 45C425 81 482 157 432 226C385 293 415 345 305 353C227 360 200 393 122 338C53 289 67 244 39 176Z" />)}
        </svg>
        <Image data-relaxation-companion src="/media/demo/rose-meditating.webp" alt="" width={480} height={480} sizes="(min-width: 768px) 224px, 128px" className="relative size-32 select-none object-contain md:size-56" draggable={false} />
      </div>
      <div data-relaxation-slideshow aria-live="off" className="grid min-h-40 w-full min-w-0 items-center px-3 py-5 text-center md:min-h-64 md:px-0 md:text-left">
        {relaxationPhrases[locale].map((phrase, index) => <p key={index} data-relaxation-phrase={index} data-active={index === state.phrase} aria-hidden={index !== state.phrase} className={cn("nexo-relax-quote col-start-1 row-start-1 text-balance text-[clamp(2rem,4.6vw,4rem)] leading-[1.2] font-light tracking-[-0.055em] motion-reduce:transition-none", index === state.phrase ? "opacity-100" : "pointer-events-none opacity-0")}>
          {phrase.split(" ").map((word, wordIndex, words) => <span key={wordIndex}><span className="nexo-relax-leaf">{word}</span>{wordIndex < words.length - 1 ? " " : ""}</span>)}
        </p>)}
      </div>
    </div>
    <div data-relaxation-controls className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6">
      <div data-relaxation-clock className="mr-1 w-16 shrink-0 text-right text-navy sm:w-20">
        <p role="timer" aria-live="off" aria-label={t.remaining} className="text-3xl leading-none font-extralight tracking-tighter tabular-nums sm:text-4xl">{formatRelaxationTime(state.remainingSeconds)}</p>
      </div>
      <Button data-relaxation-toggle data-action={toggleState} type="button" aria-label={state.status === "stopping" ? t.stopping : action} aria-describedby={`${id}-notice`} disabled={state.status === "stopping"} onClick={toggle} className={cn("min-h-11 w-44 shrink-0 rounded-full px-4 transition-colors motion-reduce:transition-none", toggleState === "stop" ? "bg-destructive text-ivory hover:bg-destructive/90" : toggleState === "restart" ? "bg-sky text-navy hover:bg-sky/80" : "bg-navy text-ivory hover:bg-navy/90")}>
        {toggleState === "stop" ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}{shortAction}
      </Button>
      <div data-relaxation-sound-controls className="flex items-center gap-3">
        <div className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
          <Volume2 aria-hidden="true" className="size-4" />
          <label htmlFor={`${id}-volume`} className="sr-only">{t.volume}</label>
          <input data-relaxation-volume id={`${id}-volume`} type="range" min={0} max={100} step={1} value={volume} aria-valuetext={`${volume}%`} className="h-11 w-20 accent-primary sm:w-24" onChange={event => {
            const next = Number(event.target.value);
            setVolume(next); session.current?.setVolume(next);
          }} />
        </div>
        <details data-relaxation-info className="relative">
          <summary aria-label={t.info} title={t.info} className="grid size-11 list-none place-items-center rounded-full text-muted-foreground hover:text-navy focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><Info aria-hidden="true" className="size-4" /></summary>
          <p className="absolute right-0 bottom-full z-10 mb-2 w-60 rounded-xl border border-border bg-background p-4 text-xs leading-6 text-muted-foreground">{t.notice}</p>
        </details>
      </div>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className={state.status === "error" ? "text-center text-xs text-destructive" : "sr-only"}>{t[state.status]}</p>
    <p id={`${id}-notice`} className="sr-only">{t.notice}</p>
  </section>;
}
