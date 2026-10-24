"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowRight, CornerDownLeft, Heart, Play, Sparkles, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanding } from "@/components/landing-provider";
import { MoodStamp, type MoodMoment } from "@/components/mood-stamp";
import { SignupForm } from "@/components/signup-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { introductionVideo } from "@/lib/landing-api";
import { IntroductionVideo } from "@/components/introduction-video";
const DemoActivities = dynamic(() => import("@/components/demo-activities").then(m => m.DemoActivities), { loading: () => <Skeleton className="h-96 w-full rounded-3xl" /> });
import { adjacentExperienceStep, experienceSteps, type ExperienceStep } from "@/lib/experience-flow";
const stepIcons = { mood: Heart, video: Play, demo: Sparkles, waitlist: UserRound };
function StepIcon({ step }: { step: ExperienceStep }) {
  const Icon = stepIcons[step];
  return <Icon aria-hidden="true" className="hidden size-5 max-md:block" />;
}

export function Experience() {
  const { locale, config, experienceNavigationTarget } = useLanding();
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const [step, setStep] = useState<ExperienceStep>("mood");
  const [mood, setMood] = useState("");
  const [moment, setMoment] = useState<MoodMoment | null>(null);
  const nextMoment = useRef(0);
  const [leaving, setLeaving] = useState(false);
  const [question, setQuestion] = useState(0);
  const [questionFading, setQuestionFading] = useState(false);
  const [loadVideo, setLoadVideo] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const moodInput = useRef<HTMLInputElement>(null);
  const previous = useRef(step);
  const video = introductionVideo(config.video_url, locale);
  useEffect(() => {
    if ((step !== "mood" && step !== "video") || mood || leaving) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    let fade: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { clearInterval(timer); clearTimeout(fade); };
    const configure = () => {
      clear();
      if (!media.matches) timer = setInterval(() => {
        setQuestionFading(true);
        fade = setTimeout(() => {
          setQuestion(value => 1 - value);
          setQuestionFading(false);
        }, 400);
      }, 6000);
    };
    const onPreferenceChange = () => { setQuestionFading(false); configure(); };
    configure(); media.addEventListener("change", onPreferenceChange);
    return () => { clear(); media.removeEventListener("change", onPreferenceChange); };
  }, [step, mood, leaving]);
  useEffect(() => {
    if (previous.current !== step) {
      heading.current?.focus({ preventScroll: true });
      if (matchMedia("(max-width: 767px)").matches) window.scrollTo({ top: 0, behavior: "instant" });
      previous.current = step;
    }
  }, [step]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), 1100);
    return () => clearTimeout(timer);
  }, [leaving]);
  const go = useCallback((next: ExperienceStep) => {
    setStep(next);
    setLeaving(false);
    if (next !== "video") setLoadVideo(false);
  }, []);
  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, video, audio, iframe, [contenteditable]:not([contenteditable="false"]), [role="tablist"], [role="slider"]')) return;
      const next = adjacentExperienceStep(step, event.key);
      if (!next) return;
      event.preventDefault();
      if (step === "mood") { moodInput.current?.form?.requestSubmit(); return; }
      go(next);
    };
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [step, go]);
  function releaseMood() {
    if (leaving) return;
    const text = mood.trim();
    setMood("");
    setQuestionFading(false);
    if (text) setMoment({ id: nextMoment.current++, text, createdAt: Date.now() });
    if (step === "mood") setLeaving(!matchMedia("(prefers-reduced-motion: reduce)").matches);
    setStep("video");
  }
  return <main data-step={step} aria-describedby="experience-keyboard-help" className="experience-main relative mx-auto w-full max-w-5xl px-6 sm:px-16 lg:px-10">
    <div className="mobile-experience-intro hidden pt-6 pb-7 text-navy">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{t("Ton espace, ton rythme", "Your space, your pace")}</p>
      <p className="mt-3 text-3xl font-medium tracking-tight">{{ mood: t("Comment vas-tu ?", "How are you?"), video: t("Fais connaissance.", "Meet Nexo."), demo: t("De quoi as-tu envie ?", "What feels right?"), waitlist: t("On garde le lien ?", "Stay in touch?") }[step]}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{step === "mood" ? t("Un mot suffit. Tu peux aussi simplement passer.", "One word is enough. Or you can simply skip.") : t("Rien à réussir. Prends ce moment comme il vient.", "Nothing to achieve. Take this moment as it comes.")}</p>
    </div>
    <p id="experience-keyboard-help" className="sr-only">{t("Hors des champs et des contrôles : flèches droite ou bas pour avancer, gauche ou haut pour revenir.", "Outside fields and controls: right or down arrow to continue, left or up arrow to go back.")}</p>
    {moment && <MoodStamp moment={moment} locale={locale} />}
    {(step === "mood" || step === "video") && <section className="mood-composer absolute z-20 w-full max-w-3xl text-center" aria-label={t("Tes mots", "Your words")}>
      <div aria-hidden="true" className="mood-composer-glow pointer-events-none absolute size-64 rounded-full bg-sky/20 blur-3xl sm:size-96" />
      {step === "mood" && <h1 ref={heading} tabIndex={-1} className="sr-only">{t("Ton instant avec Nexo", "Your moment with Nexo")}</h1>}
      <form className="relative w-full" onSubmit={event => { event.preventDefault(); releaseMood(); }}>
        <label htmlFor="mood" className="sr-only">{t("Ton humeur du moment (facultatif)", "Your current mood (optional)")}</label>
        <div className="mood-cell relative rounded-3xl sm:rounded-[2rem]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border border-navy/10 bg-mood-surface" />
          <Input ref={moodInput} id="mood" value={mood} readOnly={leaving} onChange={event => { setMood(event.target.value); setQuestionFading(false); }} onKeyDown={event => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} autoComplete="off" enterKeyHint="go" spellCheck={false} maxLength={300} aria-describedby="mood-privacy" data-placeholder-fading={questionFading} placeholder={leaving ? "" : question === 0 ? t("Comment vas-tu ?", "How are you doing?") : t("Ton humeur du jour ?", "What’s your mood today?")} className="mood-input relative h-40 rounded-[inherit] border-0 bg-transparent px-4 py-0 text-center text-[clamp(1.25rem,4.5vw,3rem)] font-light tracking-tight text-navy/70 shadow-none placeholder:text-navy/70 focus-visible:ring-0 sm:h-44 sm:px-8 md:text-[clamp(1.25rem,4.5vw,3rem)]" />
          {!leaving && mood.trim() && <button type="submit" className="mood-thought absolute right-4 bottom-[4.125rem] flex size-11 items-center justify-center text-navy/70 sm:right-7 sm:bottom-[4.625rem]" aria-label={t("Entrée : déposer mes mots", "Enter: imprint my words")}>
            <CornerDownLeft aria-hidden="true" className="relative size-4" />
          </button>}
          <Image src="/media/companions/ciel-head-on-hands.webp" alt="" aria-hidden="true" width={480} height={403} sizes="(min-width: 640px) 77px, 67px" draggable={false} className="pointer-events-none absolute right-3 bottom-0 h-14 w-auto select-none sm:right-6 sm:h-16" priority />
        </div>
        {step === "mood" && <div className="mobile-mood-actions hidden mt-6">
          <Button type="submit" disabled={leaving} className="min-h-13 w-full rounded-2xl">{mood.trim() ? t("Déposer mes mots", "Let my words go") : t("Continuer sans écrire", "Continue without writing")}<ArrowRight aria-hidden="true" className="size-4" /></Button>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">{t("Tes mots restent ici, sans envoi ni enregistrement.", "Your words stay here, without being sent or saved.")}</p>
        </div>}
        <p id="mood-privacy" className="sr-only">{t("Entrée pour déposer tes mots et rencontrer Nexo. Le dernier texte apparaît comme une empreinte datée, en dehors de la vidéo. Tu peux continuer à écrire pendant la vidéo. Le texte et l’heure restent uniquement en mémoire pendant ce parcours, sans enregistrement ni envoi.", "Press Enter to imprint your words and meet Nexo. Your latest words appear as a timestamped imprint outside the video. Keep writing during the video. The text and time stay only in memory during this journey, without being saved or sent.")}</p>
      </form>
    </section>}
    {step === "video" && <section className="experience-video mx-auto w-full min-w-0 max-w-3xl text-center">
      <h1 ref={heading} tabIndex={-1} className="sr-only">{t("Rencontrer Nexo", "Meet Nexo")}</h1>
      <div className="experience-video-space"><div className="mood-video-enter relative">
        {!video.origin || loadVideo ? <IntroductionVideo key={`${locale}-${video.url}`} video={video} locale={locale} onEnded={() => go("demo")} /> : <div className="experience-video-placeholder relative flex aspect-video min-h-48 w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-sky-soft/60 p-5 sm:rounded-[2rem]">
          <Image src="/images/ciel.webp" width={96} height={96} alt="" className="mb-4 size-20 sm:size-24" />
          <Button type="button" variant="ghost" size="icon" className="size-12 rounded-full text-navy" aria-label={t("Charger la vidéo", "Load video")} aria-describedby="video-host-notice" onClick={() => setLoadVideo(true)}><Play aria-hidden="true" className="size-5" /></Button>
          <p id="video-host-notice" className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground">{video.origin ? t("Lecture via un hébergeur externe, qui recevra ton adresse IP.", "Playback connects to an external host, which receives your IP address.") : t("Découvre Nexo, en vidéo.", "Meet Nexo, in a video.")}</p>
        </div>}
      </div></div>
    </section>}
    {step === "demo" && <section className="experience-panel experience-demo flex flex-col justify-center py-8"><h1 ref={heading} tabIndex={-1} className="sr-only">{t("Essayer Nexo", "Try Nexo")}</h1><DemoActivities locale={locale} enabled={config.demo_enabled} realtimeEnabled={config.realtime_enabled} onChatContinue={() => go("waitlist")} /></section>}
    {step === "waitlist" && <section className="experience-panel mx-auto w-full py-8"><h1 ref={heading} tabIndex={-1} className="sr-only">{t("La liste d’attente Nexo", "The Nexo waiting list")}</h1><SignupForm locale={locale} /></section>}
    <p role="status" className="sr-only">{moment ? <span key={moment.id}>{t("Empreinte déposée : ", "Words imprinted: ")}{moment.text}</span> : ""}</p>
    {experienceNavigationTarget && createPortal(
      <nav aria-label={t("Étapes du parcours", "Experience steps")} className="experience-step-nav flex flex-wrap justify-end gap-x-3">
        {experienceSteps.map(target => <button key={target} type="button" aria-current={step === target ? "step" : undefined} className="min-h-6 underline underline-offset-4 hover:text-navy aria-[current=step]:font-semibold aria-[current=step]:text-navy" onClick={() => {
          if (target === step) { heading.current?.focus({ preventScroll: true }); return; }
          if (step === "mood" && target === "video") moodInput.current?.form?.requestSubmit();
          else go(target);
        }}><StepIcon step={target} /><span>{{ mood: t("Humeur", "Mood"), video: t("Vidéo", "Video"), demo: t("Démo", "Demo"), waitlist: t("Inscription", "Sign up") }[target]}</span></button>)}
      </nav>, experienceNavigationTarget,
    )}
  </main>;
}
