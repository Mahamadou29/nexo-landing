"use client";

import Image from "next/image";
import { DoorLink } from "@/components/door-transition";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useLanding } from "@/components/landing-provider";
import { EntranceAtmosphere } from "@/components/entrance-atmosphere";
import { doorInvitations } from "@/lib/door-invitation";

export function Doors() {
  const { locale } = useLanding();
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const doors = [
    { href: "/decouvrir", image: "ciel", label: t("Ciel : découvrir Nexo", "Ciel: discover Nexo") },
    { href: "/experience", image: "noir", label: t("Noir : prendre un instant avec Nexo", "Noir: take a moment with Nexo") },
  ] as const;
  return <main className="entrance-home relative isolate mx-auto w-full px-6">
    <EntranceAtmosphere locale={locale} />
    <div className="mobile-welcome relative z-10 hidden">
      <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">{t("Un moment pour toi", "A moment for you")}</p>
      <h1 className="text-4xl leading-tight font-medium tracking-tight text-navy">{t("Bienvenue chez Nexo", "Welcome to Nexo")}</h1>
      <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">{t("Pose ta journée. Choisis ce qui te fait du bien, à ton rythme.", "Set your day down. Choose what feels right, at your own pace.")}</p>
    </div>
    <h1 className="sr-only max-md:hidden">{t("Bienvenue chez Nexo", "Welcome to Nexo")}</h1>
    <div className="door-options relative z-10 w-full max-w-4xl">
      <div className="door-avatar-row mx-auto grid w-full max-w-xl grid-cols-2 gap-4 sm:gap-28">
        {doors.map(door => <DoorLink key={door.href} href={door.href} character={door.image} aria-label={door.label} aria-describedby={`door-invitation-${door.image}`} data-door={door.image} className="avatar-door flex min-h-40 items-center justify-center rounded-full sm:min-h-56">
          <span className="avatar-frame relative isolate block size-32 sm:size-48" data-avatar={door.image}>
            <span className="avatar-portal" aria-hidden="true">
              <span className="avatar-portal-halo" />
              <span className="avatar-portal-rim" />
              <span className="avatar-portal-echo" />
            </span>
            <Image src={`/images/${door.image}.webp`} alt="" width={200} height={200} className="relative z-10 size-full object-contain" priority />
          </span>
          <span className="mobile-door-copy hidden min-w-0 flex-1 text-left">
            <span className="mb-1 block text-xs text-muted-foreground">{door.image === "ciel" ? t("Avec Ciel", "With Ciel") : t("Avec Noir", "With Noir")}</span>
            <span className="block text-lg font-medium tracking-tight text-navy">{door.image === "ciel" ? t("Découvrir Nexo", "Discover Nexo") : t("Prendre un instant", "Take a moment")}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{door.image === "ciel" ? t("Un petit tour de ton futur espace.", "A look around your future space.") : t("Écrire, respirer, ou juste être là.", "Write, breathe, or simply be here.")}</span>
          </span>
          <ArrowUpRight aria-hidden="true" className="mobile-door-arrow hidden size-5 shrink-0 text-navy" />
        </DoorLink>)}
      </div>
      {doors.map(door => <p key={door.image} id={`door-invitation-${door.image}`} className="sr-only">{doorInvitations[locale][door.image].join(" ")}</p>)}
      <div className="door-invitation-stage text-center text-navy" aria-hidden="true">
        {doors.map(door => <p key={`${locale}-${door.image}`} data-invitation={door.image} className="door-invitation">
          {doorInvitations[locale][door.image].map((chunk, beat) => <span key={beat} data-beat={beat} className="door-stamp">
            <span className="door-stamp-ink">{chunk}</span>
            <span className="door-stamp-dust" aria-hidden="true">
              {Array.from({ length: 6 }, (_, particle) => <span key={particle} />)}
            </span>
          </span>)}
        </p>)}
      </div>
    </div>
    <p className="mobile-welcome relative z-10 hidden items-center gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />{t("À explorer librement, sans compte.", "Explore freely, no account needed.")}</p>
  </main>;
}
