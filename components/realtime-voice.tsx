"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanding } from "@/components/landing-provider";
import { Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE, type Locale } from "@/lib/landing-api";
import { RealtimeVoiceSession, type VoiceState } from "@/lib/realtime-voice";
import { VoiceWaveformSvg, type VoiceWaveformHandle } from "@/components/voice-waveform";

const copy = {
  fr: {
    title: "Un échange, à voix haute",
    consent: "Nexo traite ta voix pour cet échange.",
    terms: "Conditions d’utilisation",
    duration: "Durée du prochain échange", invitation: "un peu de temps pour toi", signal: "L’échange prend forme", visualization: "Formes de l’échange en cours",
    start: "Accepter et commencer", stop: "Arrêter", mute: "Couper le micro", unmute: "Réactiver le micro", muted: "Micro coupé · tu peux encore entendre Nexo", remaining: "Temps restant",
    idle: "Micro arrêté", connecting: "Connexion… Autorise le microphone si demandé.", listening: "Nexo écoute", speaking: "Nexo parle", ended: "Échange terminé. Micro arrêté.", timeLimit: "Les 2 minutes sont terminées. Micro arrêté.",
    errors: { unavailable: "La voix est temporairement indisponible.", connection: "La connexion a été interrompue. Vérifie ton réseau.", protocol: "Le service a envoyé une réponse incompatible.", limit: "Une limite audio a été atteinte. L’échange est arrêté.", rate_limited: "Tu as atteint le nombre de tentatives autorisées. Réessaie plus tard.", busy: "Une conversation est déjà ouverte ou le service est occupé. Réessaie dans un moment.", microphone: "Microphone inaccessible. Vérifie son autorisation ou utilise le chat.", unsupported: "L’audio temps réel est indisponible dans ce navigateur. Essaie un navigateur récent en HTTPS.", timeout: "La connexion ou l’autorisation du microphone a expiré." },
  },
  en: {
    title: "A conversation, out loud",
    consent: "Nexo processes your voice for this conversation.",
    terms: "Terms of use",
    duration: "Next conversation duration", invitation: "a little time, just for you", signal: "The conversation takes shape", visualization: "Shapes of the current conversation",
    start: "Agree and start", stop: "Stop", mute: "Mute microphone", unmute: "Unmute microphone", muted: "Microphone muted · you can still hear Nexo", remaining: "Time remaining",
    idle: "Microphone off", connecting: "Connecting… Allow microphone access if prompted.", listening: "Nexo is listening", speaking: "Nexo is speaking", ended: "Conversation ended. Microphone off.", timeLimit: "The 2 minutes are over. Microphone off.",
    errors: { unavailable: "Voice is temporarily unavailable.", connection: "The connection was interrupted. Check your network.", protocol: "The service sent an incompatible response.", limit: "An audio limit was reached. The conversation has stopped.", rate_limited: "You have reached the allowed number of attempts. Please try again later.", busy: "A conversation is already open or the service is busy. Please try again shortly.", microphone: "Microphone unavailable. Check permission or use chat.", unsupported: "Realtime audio is unavailable in this browser. Try a recent browser over HTTPS.", timeout: "The connection or microphone permission timed out." },
  },
};

export function RealtimeVoice({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  return <VoiceControls key={`${pathname}-${locale}`} locale={locale} />;
}

function VoiceControls({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const { voiceNoticeTarget } = useLanding();
  const consentId = useId();
  const starting = useRef(false);
  const session = useRef<RealtimeVoiceSession | null>(null);
  const waveform = useRef<VoiceWaveformHandle | null>(null);
  const receivingAudio = useRef(false);
  const startButton = useRef<HTMLButtonElement | null>(null);
  const microphoneButton = useRef<HTMLButtonElement | null>(null);
  const activeControls = useRef<HTMLDivElement | null>(null);
  const focusAfterChange = useRef<"start" | "microphone" | null>(null);
  const [state, setState] = useState<VoiceState>({ status: "idle", muted: false, remainingSeconds: 120 });
  const active = state.status === "connecting" || state.status === "listening" || state.status === "speaking";
  useEffect(() => () => {
    const current = session.current;
    session.current = null;
    current?.stop();
  }, []);
  useEffect(() => {
    if (active && focusAfterChange.current === "microphone") microphoneButton.current?.focus({ preventScroll: true });
    if (!active && focusAfterChange.current === "start") startButton.current?.focus({ preventScroll: true });
    focusAfterChange.current = null;
  }, [active]);

  function start() {
    // The explicit consent click must also keep AudioContext.resume on the user's activation stack.
    if (active || starting.current) return;
    session.current?.stop();
    starting.current = true;
    const current = new RealtimeVoiceSession({ locale, consent: true, apiBase: API_BASE, onState: next => {
      if (session.current !== current) return;
      waveform.current?.setState(next);
      receivingAudio.current = next.status === "listening" || next.status === "speaking";
      if (!receivingAudio.current) waveform.current?.draw(null);
      const nextActive = next.status === "connecting" || receivingAudio.current;
      starting.current = nextActive;
      if (nextActive && document.activeElement === startButton.current) focusAfterChange.current = "microphone";
      if (!nextActive && activeControls.current?.contains(document.activeElement)) focusAfterChange.current = "start";
      setState(next);
    }, onWaveform: samples => {
      if (session.current === current && receivingAudio.current) waveform.current?.draw(samples);
    } });
    session.current = current;
    void current.start();
  }
  const displaySeconds = active ? state.remainingSeconds : 120;
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = String(displaySeconds % 60).padStart(2, "0");
  const status = state.status === "ended" ? (state.reason === "time_limit" ? t.timeLimit : t.ended) : state.status === "error" ? t.ended : t[state.status];
  const notice = <p id={consentId} data-voice-notice className="text-center text-[11px] leading-5 text-muted-foreground xl:whitespace-nowrap">
    {!active && <>{t.consent}{" "}</>}
    <Link href="/conditions#conversation-vocale" className="underline underline-offset-4">{t.terms}</Link>
  </p>;
  return <section data-voice-ui className="relative mx-auto flex w-full min-w-0 max-w-lg flex-col items-center gap-3 px-1 py-2 text-center sm:gap-4" aria-label={t.title}>
    <h3 className="text-xl font-light tracking-tight sm:text-2xl">{t.title}</h3>
    <div data-voice-stage className="relative flex w-full max-w-sm justify-center md:static">
      <Image src="/media/demo/ciel-speak.webp" alt="" width={480} height={480} sizes="(min-width: 640px) 128px, 96px" className="size-24 object-contain sm:size-32" draggable={false} />
      <div data-voice-clock className="absolute top-1/2 right-0 w-16 min-w-0 -translate-y-1/2 -rotate-[5deg] text-left min-[360px]:w-20 md:right-auto md:left-[calc(50%+13rem)] md:w-32">
        <p role="timer" aria-live="off" aria-label={active ? t.remaining : t.duration} className="flex items-baseline whitespace-nowrap text-[2.5rem] leading-none font-light tracking-[-0.075em] text-navy tabular-nums min-[360px]:text-5xl md:text-[5.5rem]">
          <span>{minutes}</span><span className="relative -top-[0.12em] px-[0.04em] text-[0.5em] text-muted-foreground">:</span><span className="relative top-[0.12em] text-[0.62em] tracking-[-0.06em]">{seconds}</span>
        </p>
        <p className="mt-1 pl-1 text-[10px] leading-3 font-light text-muted-foreground sm:text-[11px] sm:leading-4">{active ? t.remaining : t.invitation}</p>
      </div>
    </div>
    <div data-voice-interaction className="-mt-3 flex w-full flex-col items-center sm:-mt-4">
      <button data-voice-start ref={startButton} type="button" onClick={start} disabled={active} aria-busy={state.status === "connecting"} aria-label={active ? t.visualization : t.start} aria-describedby={consentId} className="block w-full max-w-sm cursor-pointer appearance-none rounded-[2rem] bg-transparent p-0 transition-transform duration-300 enabled:hover:scale-[1.025] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-default motion-reduce:transition-none">
        <VoiceWaveformSvg ref={waveform} />
      </button>
      <p data-voice-invitation aria-hidden="true" className="min-h-5 text-xs leading-5 text-muted-foreground">{active ? t.signal : t.start}</p>
    </div>
    <p role="status" className="min-h-10 w-full px-2 text-sm leading-5">{status}{active && state.muted ? ` · ${t.muted}` : ""}</p>
    <div className="h-12">
      {active && <div data-voice-controls ref={activeControls} className="flex min-h-12 items-center justify-center gap-5">
        <Button ref={microphoneButton} type="button" variant="ghost" size="icon" aria-label={state.muted ? t.unmute : t.mute} title={state.muted ? t.unmute : t.mute} aria-pressed={state.muted} onClick={() => session.current?.setMuted(!state.muted)} className="size-11 rounded-full text-navy aria-pressed:bg-secondary">{state.muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}</Button>
        <Button type="button" variant="outline" size="icon" aria-label={t.stop} title={t.stop} onClick={() => session.current?.stop()} className="size-11 rounded-full text-navy"><Square aria-hidden="true" /></Button>
      </div>}
    </div>
    {voiceNoticeTarget ? createPortal(notice, voiceNoticeTarget) : <div className="sr-only">{notice}</div>}
    {state.error && <p role="alert" className="text-sm text-destructive">{t.errors[state.error]}</p>}
  </section>;
}
