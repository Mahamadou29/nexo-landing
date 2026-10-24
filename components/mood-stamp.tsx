import type { Locale } from "@/lib/landing-api";

export type MoodMoment = { id: number; text: string; createdAt: number };

export function MoodStamp({ moment, locale }: { moment: MoodMoment; locale: Locale }) {
  const date = new Date(moment.createdAt);
  const timestamp = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);

  return <aside className="mood-stamp-slot" aria-label={locale === "fr" ? "Ton empreinte" : "Your imprint"}>
    <div key={moment.id} className="mood-imprint" data-mood-stamp role="note">
      <p className="mood-imprint-text" title={moment.text}>{moment.text}</p>
      <time dateTime={date.toISOString()} className="mood-imprint-time">{timestamp}</time>
    </div>
  </aside>;
}
