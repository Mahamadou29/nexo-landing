import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { ProductPreview } from "@/components/product-preview";
import { SignupForm } from "@/components/signup-form";
import { DiscoveryRoadmap } from "@/components/discovery-roadmap";
import "./discovery.css";

const ctaClass = "inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-navy px-7 py-3.5 text-sm font-medium text-ivory transition-colors hover:bg-deep";
const sectionClass = "mx-auto max-w-6xl px-6 sm:px-10";

export function Discovery({ locale }: { locale: "fr" | "en" }) {
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const features: { icon: IconName; title: string; description: string; note: string }[] = [
    { icon: "chat", title: t("Parler", "Talk"), description: t("Pas besoin de trouver les mots parfaits. Découvre les échanges à la voix avec Nexo dans la démo web, selon la disponibilité du service.", "You don’t need the perfect words. Explore voice conversations with Nexo in the web demo, subject to service availability."), note: t("Démo web · voix", "Web demo · voice") },
    { icon: "journal", title: t("Écrire", "Write"), description: t("Un mot ou quelques lignes : le chat est à découvrir dans la démo web. Le journal personnel fait partie de l’application en préparation.", "A word or a few lines: explore chat in the web demo. The personal journal is part of the app in preparation."), note: t("Démo web · chat / Application · journal", "Web demo · chat / App · journal") },
    { icon: "breath", title: t("Souffler", "Breathe"), description: t("Choisis un exercice de respiration ou une ambiance de détente dans l’expérience web. Une pause, sans objectif à atteindre.", "Choose a breathing exercise or a relaxing soundscape in the web experience. A pause, with no goal to reach."), note: t("Démo web · respiration & détente", "Web demo · breathing & relaxation") },
  ];
  const questions = [
    { title: t("Qu’est-ce que Nexo, exactement ?", "What exactly is Nexo?"), answer: t("Nexo prépare un compagnon de bien-être réunissant un chat avec une IA, un journal personnel, des exercices et des espaces de détente. Il est conçu pour t’accompagner dans tes moments du quotidien, sans diagnostic ni promesse de résultat. Cette page présente le projet : elle n’ouvre pas de conversation réelle et ne crée pas de journal. La démo web est accessible via « Essayer Nexo » ; l’application est en préparation.", "Nexo is developing a wellbeing companion combining an AI chat, a personal journal, exercises and spaces to unwind. It is designed to support you in everyday moments, without diagnoses or promises of results. This page introduces the project: it does not start a real conversation or create a journal. The web demo is accessible through ‘Try Nexo’; the app is in preparation.") },
    { title: t("Est-ce que je parle à une vraie personne ?", "Am I talking to a real person?"), answer: t("Non. Dans l’application, Ciel et Noir sont des compagnons animés associés à une intelligence artificielle, pas à des professionnels de santé. Les réponses de l’IA peuvent être inexactes ou inadaptées : garde ton esprit critique et adresse-toi à un professionnel pour un accompagnement médical. L’aperçu de cette page est uniquement illustratif.", "No. In the app, Ciel and Noir are animated companions connected to artificial intelligence, not healthcare professionals. AI responses may be inaccurate or unsuitable: use your judgement and seek professional medical support when needed. The preview on this page is illustrative only.") },
    { title: t("Où vont mes données dans l’application ?", "Where does my data go in the app?"), answer: t("Le journal, les humeurs et les notes vocales du journal restent sur ton appareil. Les messages de la conversation en cours sont envoyés au serveur Nexo, qui fait appel à un modèle d’IA. En mode conversation vocale, l’enregistrement est envoyé au serveur pour être transcrit. Tout ne reste donc pas sur ton appareil.", "Your journal, moods and journal voice notes stay on your device. Messages from the current conversation are sent to the Nexo server, which uses an AI model. In voice conversation mode, the recording is sent to the server for transcription. Not everything stays on your device.") },
    { title: t("Puis-je m’inscrire dès maintenant ?", "Can I sign up now?"), answer: t("Oui, tu peux rejoindre la liste d’attente avec ton adresse e-mail ou ton numéro de téléphone, une note facultative et ton consentement à être contacté au sujet de Nexo. L’inscription n’est confirmée qu’après son enregistrement par le serveur. Aucun compte ni mot de passe n’est créé ; rejoindre la liste ne donne pas encore accès à l’application.", "Yes, you can join the waiting list with your email address or phone number, an optional note and your consent to be contacted about Nexo. Your signup is confirmed only after the server saves it. No account or password is created; joining the list does not yet give you access to the app.") },
    { title: t("Nexo est-il disponible en français ?", "Is Nexo available in English?"), answer: t("L’application est pensée en français et en anglais. Cette page de présentation est également disponible dans les deux langues, via le sélecteur FR/EN. Elle propose une liste d’attente, pas encore de lien de téléchargement ni d’accès à un compte.", "The app is designed in French and English. This introduction is also available in both languages through the FR/EN selector. It offers a waiting list, but not yet a download link or account access.") },
    { title: t("Nexo remplace-t-il un suivi professionnel ?", "Does Nexo replace professional care?"), answer: t("Non. Nexo est un outil de soutien au quotidien, pas un dispositif de diagnostic, de traitement ou de prise en charge des urgences. Il ne remplace pas un professionnel de santé. En cas d’urgence, contacte les services d’urgence de ton pays.", "No. Nexo is a tool for everyday support, not for diagnosis, treatment or emergency care. It does not replace a healthcare professional. In an emergency, contact your country’s emergency services.") },
  ];

  return (
    <div lang={locale} className="discovery-page">
      <a href="#contenu" className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full bg-navy px-6 py-3 text-ivory focus:translate-y-0">{t("Aller au contenu", "Skip to content")}</a>
      <main id="contenu">
        <section id="accueil" aria-labelledby="hero-title" className={`${sectionClass} grid grid-cols-1 items-center gap-10 pt-12 pb-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-20 lg:pb-20`}>
          <div>
            <p className="mb-7 flex items-center gap-2.5 text-xs font-medium tracking-[0.1em] text-navy uppercase"><span className="size-2 rounded-full bg-ring" />{t("Ton compagnon, au quotidien", "Your everyday companion")}</p>
            <h1 id="hero-title" className="max-w-xl text-[clamp(2.7rem,5.1vw,4.4rem)] leading-[1.12] font-medium tracking-[-0.055em] text-navy">{t("Un peu d’espace", "A little space")}<br />{t("pour ", "for ")}<span className="relative inline-block">{t("toi.", "you.")}<svg aria-hidden="true" viewBox="0 0 130 16" className="absolute -bottom-3 left-0 h-4 w-full fill-none stroke-sky stroke-[5]"><path d="M3 10Q60 0 127 8" /></svg></span></h1>
            <p className="mt-9 max-w-md text-base leading-8 text-muted-foreground sm:text-lg">{t("Les journées sont parfois bien remplies.", "Some days can feel very full.")}<br className="hidden sm:block" />{t(" Nexo t’invite à poser tes mots, accueillir tes émotions et souffler. À ton rythme.", " Nexo invites you to share your words, make room for your emotions and breathe. At your own pace.")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5"><Link href="/experience" className={ctaClass}>{t("Essayer Nexo", "Try Nexo")} <Icon name="arrow" className="size-4" /></Link><Link href="#inscription" className="inline-flex min-h-12 items-center gap-2 text-sm text-navy underline decoration-navy/30 underline-offset-5 hover:decoration-navy">{t("Rejoindre la liste d’attente", "Join the waiting list")} <span aria-hidden="true">↘</span></Link></div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">{t("Liste d’attente · e-mail ou téléphone · aucun compte à créer", "Waiting list · email or phone · no account to create")}</p>
            <div className="mt-10 flex items-center gap-4 border-t border-border pt-6"><div className="flex -space-x-3"><Image src="/images/ciel.webp" alt="" width={46} height={46} className="rounded-full border-2 border-background bg-sky-soft" /><Image src="/images/noir.webp" alt="" width={46} height={46} className="rounded-full border-2 border-background bg-sage-soft" /></div><p className="text-xs leading-5 text-muted-foreground"><span className="font-medium text-navy">{t("Ciel ou Noir.", "Ciel or Noir.")}</span><br />{t("Deux compagnons, une place pour toi.", "Two companions, a space for you.")}</p></div>
          </div>
          <ProductPreview locale={locale} />
        </section>

        <div className="border-y border-border bg-ivory/60">
          <div className={`${sectionClass} grid gap-5 py-6 text-sm text-navy sm:grid-cols-3`}>
            <p className="flex items-center justify-center gap-3"><Icon name="heart" className="size-5" />{t("Sans jugement, sans pression", "No judgement, no pressure")}</p><p className="flex items-center justify-center gap-3"><Icon name="sun" className="size-5" />{t("De la place pour chaque humeur", "Room for every mood")}</p><p className="flex items-center justify-center gap-3"><Icon name="spark" className="size-5" />{t("À ton rythme, tout simplement", "Simply at your own pace")}</p>
          </div>
        </div>

        <section id="possibilites" aria-labelledby="features-title" className={`${sectionClass} py-20 sm:py-24`}>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-medium tracking-[0.15em] text-muted-foreground uppercase">{t("Les petits gestes comptent", "Small steps matter")}</p><h2 id="features-title" className="mt-4 max-w-lg text-3xl leading-tight font-medium tracking-tight text-navy sm:text-4xl">{t("Pas besoin de tout régler.", "You don’t have to fix everything.")}<br />{t("Juste de commencer quelque part.", "Just start somewhere.")}</h2></div><p className="max-w-xs text-sm leading-7 text-muted-foreground">{t("Une démo à explorer aujourd’hui. Une application en préparation. Et une vision pour la suite.", "A demo to explore today. An app in preparation. And a vision for what comes next.")}</p></div>
          <div className="discovery-benefits mt-10 grid gap-8 md:grid-cols-3">
            {features.map(feature => <article key={feature.icon} className="border-t border-border pt-6"><Icon name={feature.icon} className="mb-5 size-6 text-navy" /><h3 className="text-xl font-medium tracking-tight text-navy">{feature.title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p><p className="mt-5 text-xs leading-6 text-navy">{feature.note}</p></article>)}
          </div>
        </section>

        <DiscoveryRoadmap locale={locale} />

        <section id="confidentialite" aria-labelledby="privacy-title" className={`${sectionClass} py-20 sm:py-24`}>
          <div className="grid gap-8 border-t border-border pt-10 md:grid-cols-[0.85fr_1.15fr] md:gap-16">
            <div><Icon name="shield" className="size-7 text-navy" /><h2 id="privacy-title" className="mt-5 text-3xl leading-tight font-medium tracking-tight text-navy">{t("Tes mots comptent.", "Your words matter.")}<br />{t("Savoir où ils vont aussi.", "So does knowing where they go.")}</h2><p className="mt-5 max-w-xs text-sm leading-7 text-muted-foreground">{t("Parler de confiance, c’est d’abord être clair sur le fonctionnement de Nexo.", "Trust starts with being clear about how Nexo works.")}</p><Link href="/confidentialite" className="mt-4 inline-flex min-h-11 items-center text-xs text-navy underline underline-offset-4">{t("Lire la politique de confidentialité", "Read the privacy policy")}</Link></div>
            <div className="space-y-6 text-navy">
              <div className="border-b border-border pb-6"><p className="flex items-center gap-3 text-base font-medium"><Icon name="journal" className="shrink-0 text-navy" />{t("Sur ton appareil", "On your device")}</p><p className="mt-3 text-sm leading-7 text-muted-foreground">{t("Ton journal, tes humeurs et tes notes vocales du journal sont conservés localement dans l’application en préparation.", "Your journal, moods and journal voice notes are stored locally in the app in preparation.")}</p></div>
              <div className="border-b border-border pb-6"><p className="flex items-center gap-3 text-base font-medium"><Icon name="chat" className="shrink-0 text-navy" />{t("Avec le serveur Nexo", "With the Nexo server")}</p><p className="mt-3 text-sm leading-7 text-muted-foreground">{t("Dans l’application, les messages de la conversation sont envoyés au serveur, qui fait appel à un modèle d’IA. La voix utilisée dans le chat est également envoyée pour transcription.", "In the app, conversation messages are sent to the server, which uses an AI model. Voice recordings used in chat are also sent for transcription.")}</p></div>
              <p className="text-xs leading-6 text-muted-foreground">{t("Sur cette page, seul le formulaire de liste d’attente envoie tes coordonnées, ta note facultative et ton consentement au service d’inscription. L’aperçu n’ouvre pas de chat réel et n’enregistre pas de journal. Consulte la politique de confidentialité pour les traitements propres au site.", "On this page, only the waiting-list form sends your contact details, optional note and consent to the signup service. The preview does not start a real chat or save a journal. See the privacy policy for how this website handles data.")}</p>
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className={`${sectionClass} grid gap-10 pb-20 md:grid-cols-[0.7fr_1.3fr] sm:pb-24`}>
          <div><p className="text-xs font-medium tracking-[0.15em] text-muted-foreground uppercase">{t("En toute simplicité", "Keeping it simple")}</p><h2 id="faq-title" className="mt-4 text-3xl font-medium tracking-tight text-navy sm:text-4xl">{t("Tu te demandes", "You might be")}<br />{t("peut-être…", "wondering…")}</h2><p className="mt-5 max-w-xs text-sm leading-7 text-muted-foreground">{t("Quelques réponses avant de faire le premier pas.", "A few answers before you take the first step.")}</p></div>
          <div className="border-t border-navy/15">{questions.map((question, index) => <details key={index} className="group border-b border-navy/15"><summary className="flex min-h-20 list-none items-center justify-between gap-5 py-5 text-sm font-medium text-navy"><span>{question.title}</span><span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full border border-navy/20 text-lg transition-transform group-open:rotate-45">+</span></summary><p className="pr-8 pb-6 text-sm leading-7 text-muted-foreground">{question.answer}</p></details>)}</div>
        </section>

        <div id="inscription" className="border-y border-border bg-sky-soft/40 py-16 sm:py-20">
          <div className={sectionClass}><SignupForm locale={locale} /></div>
        </div>
      </main>
      <footer className={`${sectionClass} w-full pt-12 pb-8`}>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center"><Link href="/" className="text-2xl font-semibold tracking-[-0.08em] text-navy" aria-label={t("Nexo, retour à l’accueil", "Nexo, back home")}>nexo.</Link><p className="text-xs text-muted-foreground">{t("Un peu d’espace pour toi. Chaque jour, à ton rythme.", "A little space for you. Every day, at your own pace.")}</p><nav aria-label={t("Liens utiles et informations légales", "Useful and legal links")} className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-navy"><Link href="/" className="underline underline-offset-4">{t("Retour à l’accueil", "Back home")}</Link><Link href="/confidentialite" className="underline underline-offset-4">{t("Confidentialité", "Privacy")}</Link><Link href="/conditions" className="underline underline-offset-4">{t("Conditions d’utilisation", "Terms of use")}</Link></nav></div>
        <div className="mt-8 flex flex-col justify-between gap-4 border-t border-border pt-6 text-[11px] leading-6 text-muted-foreground"><p>{t("Nexo ne remplace pas un professionnel de santé et n’est pas un service d’urgence.", "Nexo does not replace a healthcare professional and is not an emergency service.")}</p><p>{t("© Nexo · Présentation en français et en anglais · Liste d’attente", "© Nexo · Introduction in French and English · Waiting list")}</p></div>
      </footer>
    </div>
  );
}
