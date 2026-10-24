"use client";

import Image from "next/image";
import { Breathing } from "@/components/breathing";
import { Relaxation } from "@/components/relaxation";
import { DemoChat } from "@/components/demo-chat";
import { RealtimeVoice } from "@/components/realtime-voice";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Headphones, MessageCircle, Mic, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type DemoLocale } from "@/lib/demo-api";

const copy = {
  fr: {
    menu: "Choisir une activité", voice: "Voix", chat: "Chat", relaxation: "Détente", breathing: "Respiration",
    invitation: "Un instant, à ta façon.", back: "Les activités", unavailableLabel: "Indisponible",
    voiceHint: "À voix haute", chatHint: "Avec tes mots", relaxationHint: "2 minutes", breathingHint: "1 minute",
    unavailable: "Cette activité n’est pas encore disponible ici. Tu peux déjà essayer Détente et Respiration.",
    continue: "Rejoindre la liste d’attente",
    chatTitle: "Un espace pour tes mots", voiceTitle: "Commence avec ta voix",
  },
  en: {
    menu: "Choose an activity", voice: "Voice", chat: "Chat", relaxation: "Relaxation", breathing: "Breathing",
    invitation: "A moment, your way.", back: "All activities", unavailableLabel: "Unavailable",
    voiceHint: "Out loud", chatHint: "In your words", relaxationHint: "2 minutes", breathingHint: "1 minute",
    unavailable: "This activity is not available here yet. You can already try Relaxation and Breathing.",
    continue: "Join the waitlist",
    chatTitle: "A little space for your words", voiceTitle: "Start with your voice",
  },
};
type Activity = "voice" | "chat" | "relaxation" | "breathing";
const activities = ["voice", "chat", "relaxation", "breathing"] as const;
const icons = { voice: Mic, chat: MessageCircle, relaxation: Headphones, breathing: Wind };
const activityImages = {
  voice: "/media/demo/ciel-speak.webp",
  chat: "/media/demo/noir-listen.webp",
  relaxation: "/media/demo/rose-meditating.webp",
  breathing: "/media/demo/ciel-inhale.webp",
} satisfies Record<Activity, string>;
const actionClass = "min-h-11 h-auto whitespace-normal rounded-full px-5 py-3";

export function DemoActivities({ locale, enabled = false, realtimeEnabled = false, onContinue, onChatContinue }: {
  locale: "fr" | "en"; enabled: boolean; realtimeEnabled?: boolean; onContinue?: () => void; onChatContinue?: () => void;
}) {
  const t = copy[locale];
  const id = useId();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [generation, setGeneration] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const choices = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLDivElement | null>(null);
  const returnTo = useRef<Activity | null>(null);
  const entering = useRef(false);

  useEffect(() => {
    if (activity && entering.current) {
      entering.current = false;
      panel.current?.focus({ preventScroll: true });
    } else if (!activity && returnTo.current) {
      choices.current[activities.indexOf(returnTo.current)]?.focus({ preventScroll: true });
      returnTo.current = null;
    }
  }, [activity]);

  function openActivity(next: Activity) {
    entering.current = true;
    setActivity(next);
  }

  return (
    <div lang={locale} className="demo-workspace min-w-0 text-navy">
      {activity === null ? <div className="demo-hub">
        <h2 className="text-center text-2xl font-light tracking-tight sm:text-4xl">{t.invitation}</h2>
        <div className="demo-orbit" role="group" aria-label={t.menu}>
          <div className="demo-companion" aria-hidden="true">
            <Image src="/images/noir.webp" alt="" width={320} height={320} sizes="(min-width: 640px) 220px, 96px" className="relative h-auto w-full select-none" draggable={false} />
          </div>
          {activities.map((item, index) => {
            const unavailable = item === "voice" ? !realtimeEnabled : item === "chat" && !enabled;
            return <button key={item} ref={node => { choices.current[index] = node; }} type="button" data-activity={item} className="demo-choice group" onClick={() => openActivity(item)}>
              <span className="demo-choice-portrait"><Image src={activityImages[item]} alt="" width={480} height={480} sizes="(min-width: 1024px) and (max-height: 420px) 32px, (min-width: 1024px) and (max-height: 600px) 40px, (min-width: 640px) 88px, 64px" className="size-full object-contain" draggable={false} /></span>
              <span className="text-sm font-medium sm:text-base">{t[item]}</span>
              <span className="text-[11px] text-muted-foreground sm:text-xs">{unavailable ? t.unavailableLabel : t[`${item}Hint`]}</span>
            </button>;
          })}
        </div>
      </div> : <>
        <div className="demo-toolbar flex shrink-0 flex-col items-center gap-2 sm:flex-row sm:gap-5">
          <Button type="button" variant="ghost" className="min-h-11 shrink-0 rounded-full px-3 text-xs text-muted-foreground" onClick={() => { returnTo.current = activity; setActivity(null); }}><ArrowLeft aria-hidden="true" className="size-4" />{t.back}</Button>
          <div role="tablist" aria-label={t.menu} aria-orientation="horizontal" className="flex w-full min-w-0 justify-center gap-1 sm:ml-auto sm:w-auto">
            {activities.map((item, index) => {
              const Icon = icons[item];
              return <Button key={item} ref={(node) => { tabs.current[index] = node; }} type="button" role="tab" id={`${id}-${item}`} aria-controls={activity === item ? `${id}-panel-${item}` : undefined} aria-selected={activity === item} tabIndex={activity === item ? 0 : -1} variant="ghost" className="min-h-11 min-w-0 flex-1 gap-2 rounded-full px-2 text-[11px] text-muted-foreground aria-selected:bg-navy aria-selected:text-ivory sm:px-4 sm:text-xs" onClick={() => setActivity(item)} onKeyDown={(event) => {
                const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : -1;
                if (next < 0) return;
                event.preventDefault();
                setActivity(activities[next]);
                tabs.current[next]?.focus();
              }}><Icon aria-hidden="true" className="hidden size-4 md:block" />{t[item]}</Button>;
            })}
          </div>
        </div>
        <div ref={panel} role="tabpanel" id={`${id}-panel-${activity}`} aria-labelledby={`${id}-${activity}`} tabIndex={0} className="demo-panel">
          {((activity === "voice" && !realtimeEnabled) || (activity === "chat" && !enabled)) ? <div className="demo-unavailable mx-auto flex max-w-md flex-col items-center justify-center gap-5 py-10 text-center">
            <Image src={activityImages[activity]} alt="" width={480} height={480} sizes="160px" className="size-40 object-contain" />
            <p className="text-xs text-muted-foreground">{t.unavailableLabel}</p>
            <h3 className="text-2xl font-light tracking-tight sm:text-3xl">{activity === "voice" ? t.voiceTitle : t.chatTitle}</h3>
            <p role="status" className="text-sm leading-7 text-muted-foreground">{t.unavailable}</p>
          </div> : <ActivityPanel key={`${activity}-${locale}-${generation}`} activity={activity} locale={locale} onChatContinue={onChatContinue} />}
        </div>
      </>}
      {onContinue && <div className="flex shrink-0 justify-end">
        <Button type="button" variant="outline" className={actionClass} onClick={() => { setGeneration((value) => value + 1); onContinue(); }}>{t.continue}<ArrowRight aria-hidden="true" /></Button>
      </div>}
    </div>
  );
}

function ActivityPanel({ activity, locale, onChatContinue }: { activity: Activity; locale: DemoLocale; onChatContinue?: () => void }) {
  return activity === "breathing" ? <Breathing locale={locale} /> : activity === "relaxation" ? <Relaxation locale={locale} /> : activity === "voice" ? <RealtimeVoice locale={locale} /> : <DemoChat locale={locale} onContinue={onChatContinue} />;
}
