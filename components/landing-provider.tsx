"use client";

import Link from "next/link";
import { ArrowLeft, Compass, House, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DiscoveryNavigation } from "@/components/discovery-navigation";
import { DoorTransitionScope } from "@/components/door-transition";
import { apiRequest, configSchema, defaultConfig, postJson, type LandingConfig, type Locale } from "@/lib/landing-api";
import { CONSENT_KEY, SESSION_KEY, clearStats, createSerialQueue, enteredDoor, eventPayload, grantConsent, readConsent, sessionId, withStatsLock, type Consent } from "@/lib/analytics";

type LandingContext = { locale: Locale; config: LandingConfig; configFailed: boolean; openSettings: () => void; experienceNavigationTarget: HTMLDivElement | null; voiceNoticeTarget: HTMLDivElement | null };
const Context = createContext<LandingContext | null>(null);
export function useLanding() { const context = useContext(Context); if (!context) throw new Error("Missing landing context"); return context; }

export function LandingProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fr");
  const [config, setConfig] = useState(defaultConfig);
  const [configFailed, setConfigFailed] = useState(false);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [settings, setSettings] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [experienceNavigationTarget, setExperienceNavigationTarget] = useState<HTMLDivElement | null>(null);
  const [voiceNoticeTarget, setVoiceNoticeTarget] = useState<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const focusSettings = useRef(false);
  const isEntrance = pathname === "/";
  const isDiscovery = pathname === "/decouvrir";
  const isMinimalPage = isEntrance || pathname === "/experience";
  const previousPath = useRef<string | null>(null);
  const localeRef = useRef(locale);
  const activeConsent = useRef<Consent | null>(null);
  const [delivery] = useState(createSerialQueue);
  const uncertainDelivery = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const settingsRef = useRef<HTMLElement>(null);
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  useEffect(() => { localeRef.current = locale; document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest("config", { signal: controller.signal }).then(r => r.json()).then(value => setConfig(configSchema.parse(value))).catch(() => { if (!controller.signal.aborted) setConfigFailed(true); });
    function restore() {
      try {
        const saved = readConsent(localStorage);
        if (!saved) sessionStorage.removeItem(SESSION_KEY);
        if (saved?.visitor_id !== activeConsent.current?.visitor_id) previousPath.current = null;
        activeConsent.current = saved;
        setConsent(saved);
        if (saved) setSettings(false);
      } catch { /* Consent remains disabled when storage is unavailable. */ }
    }
    queueMicrotask(restore);
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY || event.key === null) {
        controllers.current.forEach(c => c.abort()); previousPath.current = null; restore();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => { controller.abort(); window.removeEventListener("storage", onStorage); };
  }, []);

  const track = useCallback((path: string, force = false) => {
    const current = activeConsent.current;
    const door = enteredDoor(force ? null : previousPath.current, path);
    previousPath.current = path;
    if (!current || current.expires <= Date.now() || !door) return;
    const eventLocale = localeRef.current;
    void delivery.run(() => withStatsLock(async () => {
      // Recheck after waiting: a withdrawal may have happened in this or another tab.
      if (activeConsent.current?.visitor_id !== current.visitor_id || current.expires <= Date.now() || readConsent(localStorage)?.visitor_id !== current.visitor_id) return;
      const id = sessionId(sessionStorage, () => crypto.randomUUID());
      const controller = new AbortController(); controllers.current.add(controller);
      try { await postJson("events", eventPayload(current, id, door, eventLocale), 201, controller.signal); }
      catch { uncertainDelivery.current = true; }
      finally { controllers.current.delete(controller); }
    })).catch(() => { uncertainDelivery.current = true; });
    // No retry: Django has no event_id-based deduplication.
  }, [delivery]);
  useEffect(() => {
    activeConsent.current = consent;
    track(pathname);
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) track(pathname, true); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname, consent, track]);
  useEffect(() => {
    if (!consent) return;
    // Minute checks avoid overflowing browser timers for a 90-day permission.
    // The send path independently checks the exact deadline on every event.
    const interval = setInterval(() => {
      if (consent.expires <= Date.now()) {
        activeConsent.current = null; controllers.current.forEach(c => c.abort());
        setConsent(null); setSettings(true);
        try { clearStats(localStorage, sessionStorage); } catch { /* Storage may be disabled. */ }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [consent]);

  function accept() {
    try {
      const saved = grantConsent(localStorage, sessionStorage, () => crypto.randomUUID());
      previousPath.current = null; uncertainDelivery.current = false; activeConsent.current = saved; setConsent(saved); setSettings(false); setMessage("");
    } catch { setMessage(t("Le stockage est bloqué : les statistiques restent désactivées.", "Storage is blocked: statistics remain disabled.")); }
  }
  async function withdraw() {
    const old = activeConsent.current;
    setBusy(true); activeConsent.current = null; setConsent(null);
    // Let in-flight events finish before deletion; aborting fetch cannot undo a server write.
    let remote = !old;
    let cleared = true;
    await delivery.run(() => withStatsLock(async () => {
      try {
        if (old) await postJson("events/withdraw", { visitor_id: old.visitor_id }, [200, 204]);
        remote = !uncertainDelivery.current;
      } catch { remote = false; }
      finally {
        // Clear inside the cross-tab lock so pending events recheck the withdrawn consent.
        try { clearStats(localStorage, sessionStorage); } catch { cleared = false; }
      }
    })).catch(() => {
      remote = false;
      try { clearStats(localStorage, sessionStorage); } catch { cleared = false; }
    });
    setBusy(false); setSettings(false);
    setMessage(!remote
      ? t("Statistiques arrêtées. L’effacement sur le serveur n’a pas pu être confirmé ; les identifiants locaux ont été retirés si le navigateur le permet. Contacte l’éditeur via la page Confidentialité pour l’aide disponible.", "Statistics stopped. Server deletion could not be confirmed; local identifiers were removed where the browser permits. See Privacy for available publisher contact details.")
      : !cleared ? t("Effacement serveur confirmé, mais le stockage local est bloqué. Efface les données de ce site dans ton navigateur.", "Server deletion confirmed, but local storage is blocked. Clear this site’s data in your browser.")
      : t("Statistiques désactivées. Identifiants locaux effacés et suppression serveur confirmée.", "Statistics disabled. Local identifiers cleared and server deletion confirmed."));
  }
  function openSettings() {
    setSettings(true);
    if (!isEntrance) { focusSettings.current = true; router.push("/"); }
    else requestAnimationFrame(() => settingsRef.current?.focus());
  }
  useEffect(() => {
    if (isEntrance && settings && focusSettings.current) {
      focusSettings.current = false;
      settingsRef.current?.focus();
    }
  }, [isEntrance, settings]);

  return <Context.Provider value={{ locale, config, configFailed, openSettings, experienceNavigationTarget, voiceNoticeTarget }}>
    <DoorTransitionScope locale={locale}>
    <div data-landing-shell data-route={pathname} className={isEntrance ? "entrance-shell" : pathname === "/experience" ? "experience-shell" : "contents"}>
    <a href="#main-content" className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full bg-navy px-6 py-3 text-ivory focus:translate-y-0">{t("Aller au contenu", "Skip to content")}</a>
    <header className={`${isDiscovery ? "sticky top-0" : "relative"} z-40 bg-background ${isMinimalPage ? "" : "border-b border-border"}`}>
      <div className={`mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 ${isDiscovery ? "py-3" : "py-5"} sm:px-10`}>
        <Link href="/" className="mobile-brand flex items-center gap-3 text-3xl font-semibold tracking-[-0.08em] text-navy" aria-label={t("Nexo, les deux portes", "Nexo, two ways in")}>{!isEntrance && <ArrowLeft aria-hidden="true" className="size-5 md:hidden" />}<span>nexo<span className="text-ring">.</span></span></Link>
        {isDiscovery && <DiscoveryNavigation locale={locale} />}
        {!isMinimalPage && !isDiscovery && <nav aria-label={t("Les deux portes", "Two ways in")} className="flex items-center gap-5 text-xs text-navy sm:text-sm">
          <Link href="/decouvrir" aria-current={pathname === "/decouvrir" ? "page" : undefined} className="py-2 aria-[current=page]:underline underline-offset-4">{t("Découvrir", "Discover")}</Link>
          <Link href="/experience" aria-current={pathname === "/experience" ? "page" : undefined} className="py-2 aria-[current=page]:underline underline-offset-4">{t("Ressentir", "Experience")}</Link>
        </nav>}
        <div className="flex rounded-full border border-navy/20 p-1" role="group" aria-label={t("Langue", "Language")}>
          {(["fr", "en"] as const).map(value => <button key={value} type="button" lang={value} aria-label={value === "fr" ? "Français" : "English"} aria-pressed={locale === value} onClick={() => { setLocale(value); setMessage(""); }} className="min-h-9 min-w-10 rounded-full text-xs text-navy aria-pressed:bg-navy aria-pressed:text-ivory">{value.toUpperCase()}</button>)}
        </div>
      </div>
    </header>
    <div id="main-content" tabIndex={-1}>{children}</div>
    <footer className={`mt-auto ml-auto flex w-full shrink-0 flex-col items-end gap-1 px-6 pt-3 pb-4 text-right text-[11px] leading-5 text-muted-foreground sm:px-8 ${pathname === "/experience" ? "max-w-none sm:grid sm:grid-cols-2 sm:items-center sm:gap-x-4 xl:grid-cols-[1fr_auto_1fr]" : "max-w-sm"}`}>
      {!isMinimalPage && <p>{t("Un espace à toi. Pas un service de santé ni d’urgence.", "A space for you. Not a health or emergency service.")}</p>}
      {isEntrance && settings && <section ref={settingsRef} tabIndex={-1} aria-label={t("Statistiques facultatives", "Optional statistics")} className="w-full">
        <div className="flex flex-col items-end"><div className="flex w-full flex-wrap items-baseline justify-end gap-x-2"><h2>{t("Autoriser les statistiques de navigation ?", "Allow navigation statistics?")}</h2><details className="open:basis-full"><summary className="ml-auto min-h-6 w-fit underline underline-offset-4">{t("Détails", "Details")}</summary><p className="mt-1 text-xs leading-5">{t("Facultatif et désactivé par défaut. Après accord : identifiants pseudonymes (90 jours maximum) et pages choisies. Jamais ton humeur, tes mots ou tes coordonnées. Refuser ne change pas l’expérience.", "Optional and off by default. After consent: pseudonymous identifiers (up to 90 days) and chosen pages. Never your mood, words or contact details. Declining does not change the experience.")}</p><Link href="/confidentialite" className="inline-flex min-h-6 items-center underline underline-offset-4">{t("Confidentialité", "Privacy")}</Link></details></div>
          <div className="flex flex-wrap justify-end gap-1">{consent ? <><Button disabled={busy} variant="ghost" size="xs" className="rounded-full text-[11px] font-normal" onClick={withdraw}><span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />{t("Retirer et effacer", "Withdraw and delete")}</Button><Button variant="ghost" size="xs" className="rounded-full text-[11px] font-normal" onClick={() => setSettings(false)}>{t("Fermer", "Close")}</Button></> : <><Button disabled={busy} variant="ghost" size="xs" className="rounded-full text-[11px] font-normal" onClick={accept}><span aria-hidden="true" className="size-1.5 rounded-full bg-success" />{t("Accepter", "Accept")}</Button><Button disabled={busy} variant="ghost" size="xs" className="rounded-full text-[11px] font-normal" onClick={() => { setSettings(false); setMessage(t("Statistiques désactivées. Tu peux changer d’avis dans les paramètres.", "Statistics are off. You can change your mind in settings.")); }}><span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />{t("Refuser", "Decline")}</Button></>}</div></div>
      </section>}
      {isEntrance && <p role="status" aria-live="polite" className="text-xs leading-5 empty:sr-only">{busy ? t("Retrait en cours…", "Withdrawing…") : message}</p>}
      <nav aria-label={t("Informations et préférences", "Information and preferences")} className={`flex flex-wrap justify-end gap-x-3 ${pathname === "/experience" ? "sm:justify-self-start" : ""}`}>
        {!isEntrance && <Link className="inline-flex min-h-6 items-center underline underline-offset-4" href="/">{t("Les deux portes", "Both doors")}</Link>}
        <Link className="inline-flex min-h-6 items-center underline underline-offset-4" href="/confidentialite">{t("Confidentialité", "Privacy")}</Link>
        <Link className="inline-flex min-h-6 items-center underline underline-offset-4" href="/conditions">{t("Conditions", "Terms")}</Link>
        <button className="min-h-6 underline underline-offset-4" onClick={openSettings}>{t("Statistiques", "Statistics")}</button>
      </nav>
      {pathname === "/experience" && <>
        <div ref={setVoiceNoticeTarget} data-voice-notice-slot className="order-last w-full min-w-0 text-center empty:hidden sm:col-span-2 xl:order-none xl:col-span-1" />
        <div ref={setExperienceNavigationTarget} className="flex justify-end sm:col-start-2 xl:col-start-3" />
      </>}
    </footer>
    {pathname !== "/experience" && <nav className="mobile-app-nav hidden" aria-label={t("Navigation mobile", "Mobile navigation")}>
      {[
        { href: "/", label: t("Accueil", "Home"), icon: House },
        { href: "/decouvrir", label: t("Découvrir", "Discover"), icon: Compass },
        { href: "/experience", label: t("Mon instant", "My moment"), icon: Sparkles },
      ].map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}><Icon aria-hidden="true" className="size-5" /><span>{label}</span></Link>)}
    </nav>}
    </div>
    </DoorTransitionScope>
  </Context.Provider>;
}
