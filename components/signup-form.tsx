"use client";

import Link from "next/link";
import { ArrowRight, Check, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DEFAULT_PHONE_COUNTRY, getPhoneCountries, makeSignupSchema, type SignupCountry, type SignupValues } from "@/lib/signup-schema";
import { errorMessage, POLICY_VERSION, postJson, type Locale } from "@/lib/landing-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import "./signup.css";

const subscribe = () => () => {};

function SignupCells({ confirmed }: { confirmed: boolean }) {
  return <div className="signup-cells" data-confirmed={confirmed} aria-hidden="true">
    <div className="signup-cells-halo" />
    <div className="signup-cell-orbit">{Array.from({ length: 7 }, (_, index) => <span key={index} className="signup-cell"><span /></span>)}</div>
    {confirmed && <span className="signup-cell-check"><Check className="size-7" strokeWidth={1.5} /></span>}
  </div>;
}

export function SignupForm({ locale = "fr" }: { locale?: Locale }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const titleId = useId();
  const statusId = useId();
  const countryId = useId();
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;
  const [kind, setKind] = useState<"email" | "phone">("email");
  const [country, setCountry] = useState<SignupCountry>(DEFAULT_PHONE_COUNTRY);
  const countries = getPhoneCountries(locale);
  const selectedCountry = countries.find(option => option.country === country)!;
  const [status, setStatus] = useState<"idle" | "sending" | "registered" | "error">("idle");
  const [failure, setFailure] = useState<unknown>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const form = useForm<SignupValues>({ resolver: zodResolver(makeSignupSchema(locale, country)), defaultValues: { email: "", phone: "", note: "", consent: false }, shouldFocusError: false });
  const confirmed = status === "registered";
  const disabled = !ready || status === "sending";
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  useEffect(() => { form.clearErrors(); }, [locale, form]);
  useEffect(() => { if (status === "registered") successHeading.current?.focus(); }, [status]);

  async function submit(values: SignupValues) {
    if (!mounted.current || request.current || status === "registered") return;
    const controller = new AbortController();
    request.current = controller;
    setFailure(null);
    setStatus("sending");
    try {
      const response = await postJson("waitlist", { ...(values.email ? { email: values.email } : { phone: values.phone }), ...(values.note ? { note: values.note } : {}), locale, consent: true, policy_version: POLICY_VERSION }, 201, controller.signal);
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("status" in body) || body.status !== "registered") throw new Error("Invalid response");
      if (!controller.signal.aborted) { form.reset(); setCountry(DEFAULT_PHONE_COUNTRY); setStatus("registered"); }
    } catch (error) {
      if (!controller.signal.aborted) { setFailure(error); setStatus("error"); }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  return <section className="signup-shell w-full min-w-0 text-navy" data-signup-state={status} aria-labelledby={titleId}>
    <header className="mb-6 px-1">
      <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{t("La liste d’attente Nexo", "The Nexo waiting list")}</p>
      <h2 id={titleId} className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">{t("Le début d’un lien.", "The start of a connection.")}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Un contact. Ton accord. Et on garde le lien.", "One contact. Your permission. And we’ll stay in touch.")}</p>
    </header>
    <Form {...form}><form noValidate aria-busy={status === "sending"} aria-describedby={statusId} onSubmit={event => {
      void form.handleSubmit(submit, errors => {
        if (errors.email || errors.phone) form.setFocus(kind);
        else if (errors.note) form.setFocus("note");
        else if (errors.consent) form.setFocus("consent");
      })(event);
    }} className="signup-grid">
      <div className="signup-card border border-border bg-ivory" data-signup-card="contact">
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex size-8 items-center justify-center rounded-full border border-navy/15">{confirmed ? <Check aria-hidden="true" className="size-4 text-navy" /> : "01"}</span><span>{t("Tes informations", "Your details")}</span></div>
        {confirmed ? <div className="my-auto py-10" data-signup-receipt>
          <span className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-sky-soft">{kind === "email" ? <Mail aria-hidden="true" className="size-6" strokeWidth={1.5} /> : <Smartphone aria-hidden="true" className="size-6" strokeWidth={1.5} />}</span>
          <h3 className="text-2xl font-medium tracking-tight">{t("Le lien est créé.", "We’re connected.")}</h3>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{kind === "email" ? t("On t’écrira par e-mail pour les nouvelles du lancement.", "We’ll email you with launch updates.") : t("On te recontactera sur ton téléphone pour les nouvelles du lancement.", "We’ll contact you on your phone with launch updates.")}</p>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">{t("Aucun compte créé. Aucun mot de passe à retenir. Juste un prochain rendez-vous.", "No account created. No password to remember. Just something to look forward to.")}</p>
          <Link href="/confidentialite" className="mt-6 inline-flex min-h-11 items-center text-xs underline underline-offset-4">{t("Tes données, tes droits", "Your data, your rights")}</Link>
        </div> : <fieldset disabled={disabled} className="mt-5 min-w-0 space-y-5">
          <legend className="sr-only">{t("Coordonnées de contact", "Contact details")}</legend>
          <h3 className="text-xl font-medium tracking-tight">{t("Où te retrouver ?", "Where can we reach you?")}</h3>
          <div role="group" aria-label={t("Choisir un moyen de contact", "Choose a contact method")} className="grid grid-cols-2 gap-2 rounded-2xl bg-background p-1.5">
            {(["email", "phone"] as const).map(value => <Button key={value} type="button" variant="ghost" disabled={disabled} aria-pressed={kind === value} className="h-auto min-h-11 min-w-0 gap-2 whitespace-normal rounded-xl px-2 py-2 text-xs aria-pressed:bg-ivory aria-pressed:shadow-sm" onClick={() => {
              setKind(value);
              form.setValue(value === "email" ? "phone" : "email", "");
              form.clearErrors();
              setFailure(null);
              setStatus("idle");
            }}>{value === "email" ? <Mail aria-hidden="true" className="size-4" /> : <Smartphone aria-hidden="true" className="size-4" />}{value === "email" ? "E-mail" : t("Téléphone", "Phone")}</Button>)}
          </div>
          {kind === "email" ? <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>{t("Adresse e-mail", "Email address")}</FormLabel><FormControl><Input {...field} type="email" autoComplete="email" maxLength={254} placeholder={t("toi@exemple.fr", "you@example.com")} className="h-13 rounded-xl bg-background" /></FormControl><FormDescription>{t("Uniquement pour les nouvelles du lancement.", "Only for launch updates.")}</FormDescription><FormMessage /></FormItem>} /> : <>
            <div className="space-y-2">
              <label htmlFor={countryId} className="text-sm font-medium">{t("Pays du numéro", "Phone country")}</label>
              <select id={countryId} name="phoneCountry" autoComplete="section-signup country" value={country} disabled={disabled} className="h-13 w-full min-w-0 rounded-xl border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm" onChange={event => {
                const option = countries.find(item => item.country === event.target.value);
                if (!option) return;
                setCountry(option.country);
                form.clearErrors("phone");
              }}>
                {countries.map(option => <option key={option.country} value={option.country}>{option.name} ({option.dialCode})</option>)}
              </select>
            </div>
            <FormField control={form.control} name="phone" render={({ field }) => <FormItem>
              <FormLabel>{t("Numéro de téléphone (national)", "Phone number (national)")}</FormLabel>
              <div className="flex min-w-0 items-center gap-2">
                <span data-signup-dial-code aria-hidden="true" className="shrink-0 rounded-xl border border-input bg-background px-3 py-3 font-medium tabular-nums">{selectedCountry.dialCode}</span>
                <FormControl><Input {...field} type="tel" autoComplete="tel-national" inputMode="tel" maxLength={64} className="h-13 rounded-xl bg-background" /></FormControl>
              </div>
              <FormDescription>{t(
                `Indicatif : ${selectedCountry.dialCode} (${selectedCountry.name}). Saisis le numéro national, ou colle un numéro avec + correspondant au pays choisi. Espaces et tirets acceptés.`,
                `Calling code: ${selectedCountry.dialCode} (${selectedCountry.name}). Enter the national number, or paste a number with + matching the selected country. Spaces and hyphens are accepted.`,
              )}</FormDescription>
              <FormMessage />
            </FormItem>} />
          </>}
          <FormField control={form.control} name="note" render={({ field }) => <FormItem><FormLabel>{t("Un mot pour nous (facultatif)", "A note for us (optional)")}</FormLabel><FormControl><textarea {...field} maxLength={1000} rows={3} className="w-full min-w-0 resize-y rounded-xl border border-input bg-background p-3 text-base sm:text-sm" /></FormControl><FormDescription>{t("Évite les informations de santé ou confidentielles. 1 000 caractères maximum.", "Please avoid health or confidential information. Up to 1,000 characters.")}</FormDescription><FormMessage /></FormItem>} />
        </fieldset>}
      </div>
      <div className="signup-card border border-sky bg-sky-soft" data-signup-card="confirm">
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex size-8 items-center justify-center rounded-full border border-navy/15">{confirmed ? <Check aria-hidden="true" className="size-4 text-navy" /> : "02"}</span><span>{confirmed ? t("Inscription confirmée", "Registration confirmed") : t("Ton accord", "Your permission")}</span></div>
        <SignupCells confirmed={confirmed} />
        {confirmed ? <div className="pb-6 text-center" data-signup-success>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{t("Un peu de place pour la suite", "A little room for what’s next")}</p>
          <h3 ref={successHeading} tabIndex={-1} className="mt-3 rounded-lg text-3xl font-medium tracking-tight">{t("Tu fais partie de l’aventure.", "You are part of the journey.")}</h3>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-7 text-muted-foreground">{t("Merci d’être là. Ta place sur la liste d’attente est confirmée.", "Thank you for being here. Your place on the waiting list is confirmed.")}</p>
        </div> : <fieldset disabled={disabled} className="mt-auto min-w-0 space-y-5">
          <legend className="sr-only">{t("Consentement et inscription", "Permission and registration")}</legend>
          <div><h3 className="text-xl font-medium tracking-tight">{t("La suite, si tu en as envie.", "What’s next is up to you.")}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{t("Sans compte ni mot de passe. Ton choix est indépendant des statistiques.", "No account or password. Your choice is separate from statistics.")}</p></div>
          <FormField control={form.control} name="consent" render={({ field }) => <FormItem><div className="flex items-start gap-3"><FormControl><input type="checkbox" checked={field.value} onChange={event => field.onChange(event.target.checked)} onBlur={field.onBlur} name={field.name} ref={field.ref} className="mt-1 size-5 shrink-0 rounded accent-navy" /></FormControl><FormLabel className="min-h-11 text-xs leading-6">{t("J’accepte que Nexo utilise ces coordonnées et ma note pour me recontacter au sujet du lancement. Je peux retirer mon accord.", "I agree that Nexo may use these contact details and my note to contact me about the launch. I can withdraw my permission.")}</FormLabel></div><FormDescription><Link href="/confidentialite" className="inline-flex min-h-11 items-center underline underline-offset-4">{t("Utilisation des données et droits", "Data use and your rights")}</Link></FormDescription><FormMessage /></FormItem>} />
          <Button type="submit" disabled={disabled} className="h-auto min-h-13 w-full min-w-0 gap-3 whitespace-normal rounded-full px-5 py-3 text-left">
            <span>{status === "sending" ? t("Envoi en cours…", "Sending…") : status === "error" ? t("Réessayer l’inscription", "Try signing up again") : t("Rejoindre la liste d’attente", "Join the waiting list")}</span>
            {status === "sending" ? <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-ivory/40 border-t-ivory motion-safe:animate-spin" /> : <ArrowRight aria-hidden="true" className="size-4" />}
          </Button>
        </fieldset>}
      </div>
    </form></Form>
    <div className="mt-4 flex items-start gap-2 px-1"><ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" /><p id={statusId} role="status" aria-live="polite" aria-atomic="true" className={cn("text-xs leading-6", status === "error" ? "text-destructive" : "text-muted-foreground")}>
      {confirmed ? t("Ton inscription sur la liste d’attente est confirmée. Merci ! Aucun compte n’a été créé.", "You’re on the waiting list. Thank you! No account has been created.") : status === "error" ? errorMessage(failure, locale) : status === "sending" ? t("Envoi au service Nexo. En attente de sa confirmation…", "Sending to the Nexo service. Waiting for confirmation…") : t("Confirmation uniquement après réception par le service Nexo.", "Confirmed only when the Nexo service accepts your request.")}
    </p></div>
    <noscript><p className="mt-3 text-sm">{t("JavaScript est nécessaire pour envoyer ce formulaire.", "JavaScript is required to submit this form.")}</p></noscript>
  </section>;
}
