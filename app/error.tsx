"use client";
import { useLanding } from "@/components/landing-provider";
import { DoorRouteReady } from "@/components/door-transition";
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLanding();
  return <main className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-start justify-center gap-6 px-6"><h1 className="text-3xl font-medium text-navy">{locale === "fr" ? "Un petit contretemps." : "A little interruption."}</h1><p className="text-muted-foreground">{locale === "fr" ? "La page n’a pas pu s’afficher. Tu peux réessayer." : "This page couldn’t be displayed. Please try again."}</p><button onClick={reset} className="min-h-12 rounded-full bg-navy px-6 text-ivory">{locale === "fr" ? "Réessayer" : "Try again"}</button><DoorRouteReady /></main>;
}
