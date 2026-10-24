"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bindEntrancePlayback } from "@/lib/entrance-motion";
import { AnimatedEntranceScene } from "@/components/entrance-scene";
import type { Locale } from "@/lib/landing-api";

const motionQuery = "(prefers-reduced-motion: reduce), (max-width: 767px)";
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const reducedMotionSnapshot = () => window.matchMedia(motionQuery).matches;
const serverMotionSnapshot = () => true;

type EntranceAtmosphereProps = { locale: Locale };

export function EntranceAtmosphere({ locale }: EntranceAtmosphereProps) {
  const playback = useRef<ReturnType<typeof bindEntrancePlayback> | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, reducedMotionSnapshot, serverMotionSnapshot);
  const label = locale === "fr"
    ? paused ? "Reprendre l’animation de fond" : "Mettre l’animation de fond en pause"
    : paused ? "Resume background animation" : "Pause background animation";

  return <>
    <div className="entrance-atmosphere" aria-hidden="true">
      {!reducedMotion && <AnimatedEntranceScene key={locale} locale={locale} paused={pausedRef} playback={playback} onReady={setReady} />}
    </div>
    {ready && !reducedMotion && <Button type="button" variant="ghost" size="icon" className="entrance-motion-control absolute bottom-4 left-6 z-20 rounded-full text-muted-foreground hover:bg-ivory hover:text-navy sm:left-10" aria-label={label} title={label} onClick={() => {
      pausedRef.current = !pausedRef.current;
      setPaused(pausedRef.current);
      playback.current?.setPaused(pausedRef.current);
    }}>
      {paused ? <Play aria-hidden="true" className="size-3" /> : <Pause aria-hidden="true" className="size-3" />}
    </Button>}
  </>;
}
