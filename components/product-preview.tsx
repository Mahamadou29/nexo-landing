"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export function ProductPreview({ locale = "fr" }: { locale?: "fr" | "en" }) {
  const [companion, setCompanion] = useState<"ciel" | "noir">("ciel");
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  return (
    <div lang={locale} className="relative mx-auto w-full max-w-lg py-5 lg:py-0">
      <div className="absolute -inset-4 rounded-full bg-sky/30 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2.5rem] border border-ivory bg-sky-soft p-5 shadow-2xl shadow-navy/10 sm:p-7">
        <Image src={companion === "ciel" ? "/images/day.webp" : "/images/night.webp"} alt="" fill sizes="(max-width: 640px) 100vw, 512px" className="object-cover" priority />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-ivory/95 px-3 py-2 text-[10px] font-medium tracking-[0.12em] text-navy uppercase">{t("Un instant avec Nexo", "A moment with Nexo")}</span>
            <Icon name="spark" className="text-navy" />
          </div>
          <div className="mt-5 rounded-3xl border border-ivory/70 bg-ivory/90 px-5 pt-6 text-center text-navy">
            <span className="text-xs text-muted-foreground">{t("Ici, tu peux être toi.", "Here, you can be yourself.")}</span>
            <h2 className="mt-2 text-[23px] font-medium tracking-tight">{t("Comment te sens-tu,", "How are you feeling,")}<br />{t("là, maintenant ?", "right now?")}</h2>
            <div className="relative mx-auto h-52 w-full max-w-60 sm:h-60 sm:max-w-72">
              <Image src={`/images/${companion}.webp`} alt={companion === "ciel" ? t("Compagnon Ciel, bleu et souriant", "Ciel companion, blue and smiling") : t("Compagnon Noir, sombre et paisible", "Noir companion, dark and peaceful")} fill sizes="288px" className="object-contain" priority />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-ivory/95 p-4 text-navy">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-soft"><Icon name="breath" /></span>
            <div><p className="text-sm font-medium">{t("Et si on soufflait un peu ?", "Shall we take a breath?")}</p><p className="mt-1 text-xs text-muted-foreground">{t("Une pause, à ton rythme.", "A pause, at your own pace.")}</p></div>
          </div>
          <fieldset className="mt-5 rounded-2xl bg-ivory/95 p-3">
            <legend className="sr-only">{t("Choisir le compagnon de l’aperçu", "Choose the preview companion")}</legend>
            <div className="flex flex-wrap items-center justify-between gap-3"><span className="pl-1 text-xs text-navy">{t("Ton compagnon", "Your companion")}</span><div className="flex gap-1">
              {(["ciel", "noir"] as const).map((name) => <button key={name} type="button" aria-pressed={companion === name} onClick={() => setCompanion(name)} className={cn("min-h-11 rounded-full px-4 text-xs font-medium transition-colors", companion === name ? "bg-navy text-ivory" : "text-navy hover:bg-sky-soft")}>{name === "ciel" ? "Ciel" : "Noir"}</button>)}
            </div></div>
          </fieldset>
        </div>
      </div>
      <p className="relative mt-4 text-center text-[11px] text-muted-foreground">{t("Aperçu illustratif de l’application · pas de conversation réelle ni de journal enregistré", "Illustrative app preview · no real conversation or saved journal")}</p>
    </div>
  );
}
