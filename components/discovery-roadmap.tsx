import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

export function DiscoveryRoadmap({ locale }: { locale: "fr" | "en" }) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const steps: { id: string; status: string; title: string; description: string; detail: string; icon: IconName }[] = [
    {
      id: "demo", status: t("Aujourd’hui · démo web", "Today · web demo"),
      title: t("Un premier espace pour toi", "A first space for you"),
      description: t("Parler à la voix, échanger par chat, se détendre ou respirer : l’expérience web permet de découvrir l’univers Nexo.", "Talk by voice, chat, unwind or breathe: the web experience offers a first feel for Nexo."),
      detail: t("Les échanges avec l’IA dépendent de la disponibilité du service. Cette démo n’est pas l’application complète.", "AI conversations depend on service availability. This demo is not the full app."), icon: "breath",
    },
    {
      id: "app", status: t("En préparation · application", "In preparation · app"),
      title: t("Un compagnon au quotidien", "An everyday companion"),
      description: t("Réunir les conversations, un journal personnel et des espaces de pause autour de Ciel ou Noir. Un lieu à retrouver à ton rythme.", "Bring conversations, a personal journal and spaces to pause together with Ciel or Noir. Somewhere to return to at your own pace."),
      detail: t("La liste d’attente est ouverte ; l’inscription ne donne pas encore accès à l’application.", "The waiting list is open; signing up does not yet give access to the app."), icon: "journal",
    },
    {
      id: "reminders", status: t("Prévu · rappels dans l’application", "Planned · in-app reminders"),
      title: t("Une invitation, jamais une obligation", "An invitation, never an obligation"),
      description: t("Des rappels que tu programmes, et, si tu le souhaites, des invitations de Nexo à prendre un moment pour toi. Tu choisis les horaires et les types de rappels que tu souhaites recevoir.", "Reminders you schedule, and, if you wish, invitations from Nexo to take a moment for yourself. You choose the times and types of reminders you want to receive."),
      detail: t("Uniquement avec ton accord. Tu pourras les modifier, les mettre en pause ou les désactiver. Ce n’est pas une surveillance de ton état ; cette fonction n’est pas encore disponible.", "Only with your permission. You will be able to change, pause or disable them. This is not monitoring how you feel; this feature is not available yet."), icon: "sun",
    },
    {
      id: "classic-plush", status: t("À venir · peluche classique", "Future · classic plush"),
      title: t("Ciel ou Noir, à serrer contre toi", "Ciel or Noir, to hold close"),
      description: t("D’abord, imaginer Ciel et Noir en peluches classiques, sans connexion. Une présence toute simple, loin des écrans.", "First, imagine Ciel and Noir as classic, non-connected plush companions. A simple presence, away from screens."),
      detail: t("Une intention pour la suite, pas un produit disponible ni une précommande.", "An idea for the future, not an available product or a preorder."), icon: "heart",
    },
    {
      id: "connected-plush", status: t("Plus loin · peluche connectée", "Further ahead · connected plush"),
      title: t("Explorer une autre forme de présence", "Explore another way to be there"),
      description: t("Après la peluche classique, explorer une version connectée, dans la continuité de l’univers Nexo.", "After the classic plush, explore a connected version as part of the Nexo world."),
      detail: t("Une piste à explorer : son fonctionnement reste à définir, sans fonctionnalité technique ni date annoncée.", "An idea to explore: how it would work is still to be defined, with no technical features or dates announced."), icon: "spark",
    },
  ];

  return (
    <section id="parcours" aria-labelledby="roadmap-title" aria-describedby="roadmap-note" className="discovery-roadmap border-y border-border bg-ivory py-20 sm:py-24">
      <div id="roadmap" className="mx-auto grid max-w-6xl gap-12 px-6 sm:px-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
        <div>
          <p className="text-xs font-medium tracking-[0.15em] text-muted-foreground uppercase">{t("La vision Nexo", "The Nexo vision")}</p>
          <h2 id="roadmap-title" className="mt-4 max-w-sm text-3xl leading-tight font-medium tracking-tight text-navy sm:text-4xl">{t("Le chemin se dessine.", "The journey ahead.")}</h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">{t("D’un premier échange à une présence à serrer contre soi. Voici ce qui existe déjà, et ce que Nexo souhaite construire, pas à pas.", "From a first conversation to a companion you can hold close. Here is what exists today, and what Nexo hopes to build, step by step.")}</p>
          <p id="roadmap-note" className="mt-5 max-w-sm text-xs leading-6 text-muted-foreground">{t("Une vision qui peut évoluer, pas un calendrier de lancement. Aucune date annoncée.", "An evolving vision, not a launch schedule. No dates have been announced.")}</p>
          <Link href="#inscription" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-navy underline decoration-navy/30 underline-offset-5">{t("Rejoindre l’aventure", "Join the journey")}<Icon name="arrow" className="size-4" /></Link>
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            {t("Suivre l’aventure sur Instagram", "Follow the journey on Instagram")}<br />
            <a href="https://www.instagram.com/nexo.companion" rel="noreferrer" aria-label={t("Nexo sur Instagram : @nexo.companion", "Nexo on Instagram: @nexo.companion")} className="inline-flex min-h-11 items-center text-navy underline decoration-navy/30 underline-offset-5 hover:decoration-navy">@nexo.companion</a>
          </p>
        </div>
        <ol className="discovery-roadmap-list" role="list">
          {steps.map(step => (
            <li key={step.id} data-roadmap-step={step.id} className="discovery-roadmap-step">
              <span aria-hidden="true" className="discovery-roadmap-marker"><Icon name={step.icon} className="size-5" /></span>
              <div className="min-w-0">
                <p data-roadmap-status className="text-xs font-medium leading-6 text-muted-foreground">{step.status}</p>
                <h3 className="mt-2 text-xl leading-snug font-medium tracking-tight text-navy">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">{step.detail}</p>
                {step.id === "demo" && <Link href="/experience" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-navy underline decoration-navy/30 underline-offset-5">{t("Essayer Nexo", "Try Nexo")}<Icon name="arrow" className="size-4" /></Link>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
