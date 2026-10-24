"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { useLanding } from "@/components/landing-provider";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MAX_MESSAGE_LENGTH, type DemoLocale, type DemoMessage } from "@/lib/demo-api";
import { DemoChatSession, chatCapacity, emptyChat } from "@/lib/demo-chat";
import { CHAT_VISITOR_KEY } from "@/lib/demo-chat-visitor";
import { cn } from "@/lib/utils";

const copy = {
  fr: {
    title: "Un espace pour tes mots", empty: "Qu’aimerais-tu partager ?", intro: "Quelques mots suffisent. À ton rythme.",
    message: "Ton message", messages: "Conversation avec Nexo", you: "Toi", placeholder: "Écris ici…",
    agree: "Accepter et envoyer", send: "Envoyer", stop: "Arrêter la réponse", clear: "Effacer la conversation",
    remaining: "réponses restantes", remainingOne: "réponse restante", finished: "Tes 15 réponses sont utilisées. Tu peux poursuivre le parcours ; effacer la conversation ne renouvelle pas ce solde.", continue: "Rejoindre la liste d’attente",
    notice: "Nexo traite tes messages pour cet échange.", terms: "Conditions d’utilisation",
    quotaLoading: "Vérification des réponses disponibles…", quotaFailed: "Le solde ne peut pas être vérifié. Réessaie avant d’envoyer.", storage: "Le stockage du navigateur est inaccessible ou l’identifiant a changé. Le chat reste désactivé. Vérifie les autorisations de stockage, puis réessaie.", quotaRetry: "Réessayer",
    help: "Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne.", budget: "caractères disponibles pour le prochain message",
    invalid: "Écris un message de 1 à 2 000 caractères.", full: "Cette conversation est complète. Efface-la pour commencer un nouvel échange.",
    sending: "Nexo répond…", sent: "Réponse reçue.", cancelled: "Réponse arrêtée. Ton message reste prêt à être renvoyé.",
    errors: {
      exhausted: "Tes 15 réponses sont utilisées. Effacer la conversation ne renouvelle pas ce solde.", busy: "Une réponse est déjà en cours dans un autre onglet. Attends sa fin, puis réessaie.", visitor: "L’identifiant du chat est invalide. L’envoi est désactivé.",
      unavailable: "Le chat est temporairement indisponible. Réessaie plus tard.",
      network: "La connexion a été interrompue. Ton message est conservé ; tu peux réessayer.",
      timeout: "La réponse a pris trop de temps. Ton message est conservé ; réessaie plus tard.",
      response: "La réponse n’a pas abouti. Ton message est conservé ; tu peux réessayer.",
      limit: "Le contenu dépasse une limite de l’échange. Raccourcis ton message ou recommence la conversation.",
      rate_limited: "Trop de demandes pour le moment. Patiente avant de réessayer ; effacer la conversation ne change pas cette limite.",
      consent: "Accepte l’envoi avec le bouton « Accepter et envoyer ».",
    },
  },
  en: {
    title: "A little space for your words", empty: "What would you like to share?", intro: "A few words are enough. At your own pace.",
    message: "Your message", messages: "Conversation with Nexo", you: "You", placeholder: "Write here…",
    agree: "Agree and send", send: "Send", stop: "Stop reply", clear: "Clear conversation",
    remaining: "replies remaining", remainingOne: "reply remaining", finished: "Your 15 replies have been used. Continue your journey; clearing the conversation does not renew this allowance.", continue: "Join the waitlist",
    notice: "Nexo processes your messages for this conversation.", terms: "Terms of use",
    quotaLoading: "Checking available replies…", quotaFailed: "Your allowance could not be checked. Retry before sending.", storage: "Browser storage is unavailable or the visitor ID has changed. Chat stays disabled. Check storage permissions, then retry.", quotaRetry: "Try again",
    help: "Enter to send · Shift + Enter for a new line.", budget: "characters available for your next message",
    invalid: "Write a message between 1 and 2,000 characters.", full: "This conversation is full. Clear it to start a new conversation.",
    sending: "Nexo is replying…", sent: "Reply received.", cancelled: "Reply stopped. Your message is ready to send again.",
    errors: {
      exhausted: "Your 15 replies have been used. Clearing the conversation does not renew this allowance.", busy: "A reply is already in progress in another tab. Wait for it to finish, then try again.", visitor: "The chat visitor ID is invalid. Sending is disabled.",
      unavailable: "Chat is temporarily unavailable. Please try again later.",
      network: "The connection was interrupted. Your message is kept; you can try again.",
      timeout: "The reply took too long. Your message is kept; please try again later.",
      response: "The reply did not finish. Your message is kept; you can try again.",
      limit: "The content exceeds a conversation limit. Shorten your message or start a new conversation.",
      rate_limited: "Too many requests right now. Please wait before retrying; clearing the conversation will not reset this limit.",
      consent: "Agree to sending with the “Agree and send” button.",
    },
  },
};

function renderMessage(message: DemoMessage, index: number, you: string) {
  return <li key={index} className={cn("max-w-[90%] whitespace-pre-wrap wrap-anywhere text-sm leading-7 sm:max-w-[85%]", message.role === "user" ? "ml-auto w-fit rounded-2xl rounded-br-sm bg-navy px-4 py-3 text-ivory" : "mr-auto w-full py-3 text-foreground")}>
    <span className={cn("mb-1 block text-[11px]", message.role === "user" ? "sr-only" : "text-muted-foreground")}>{message.role === "user" ? you : "Nexo"}</span>
    {message.content ? message.role === "user" ? message.content : message.content.match(/\S+\s*|\s+/gu)?.map((word, index) => <span key={index} className="nexo-chat-word">{word}</span>) : <span data-chat-typing aria-hidden="true" className="flex h-7 items-center gap-2">
      {[
        "M12 2C18 1 22 6 21 12C22 18 17 22 11 21C5 22 2 17 3 11C2 6 6 2 12 2Z",
        "M11 3C17 1 22 5 21 11C23 17 18 21 12 22C6 22 2 18 2 12C1 7 5 3 11 3Z",
        "M12 2C18 2 21 6 22 12C21 18 17 22 11 21C5 21 1 16 3 10C3 5 7 1 12 2Z",
      ].map((shape, cell) => <svg key={cell} viewBox="0 0 24 24" focusable="false" className="nexo-chat-cell size-3.5 overflow-visible"><path d={shape} /></svg>)}
    </span>}
  </li>;
}

export function DemoChat({ locale, onContinue }: { locale: DemoLocale; onContinue?: () => void }) {
  const pathname = usePathname();
  return <ChatControls key={`${pathname}-${locale}`} locale={locale} onContinue={onContinue} />;
}

function ChatControls({ locale, onContinue }: { locale: DemoLocale; onContinue?: () => void }) {
  const t = copy[locale];
  const { voiceNoticeTarget } = useLanding();
  const noticeId = useId();
  const titleId = useId();
  const schema = z.object({ content: z.string().trim().min(1, t.invalid).max(MAX_MESSAGE_LENGTH, t.invalid) });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { content: "" } });
  const draft = useWatch({ control: form.control, name: "content" });
  const [state, setState] = useState(emptyChat);
  const session = useRef<DemoChatSession | null>(null);
  const submission = useRef<symbol | null>(null);
  const draftRevision = useRef(0);
  const submittedDraft = useRef<{ text: string; revision: number; token: symbol } | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);
  const capacity = chatCapacity(state.messages);
  const busy = state.status === "sending";
  const exhausted = state.remaining === 0;
  const quotaReady = state.quotaStatus === "ready" && state.remaining !== null;
  const remainingLabel = state.remaining === 1 ? t.remainingOne : t.remaining;

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("nexo.chat.quota.v1"); }
    catch { /* Optional cross-tab notifications may be blocked; focus still refreshes quota. */ }
    const current = new DemoChatSession(locale, setState, { onSettled: () => channel?.postMessage("refresh") });
    session.current = current;
    const refresh = () => { void current.refreshQuota(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === CHAT_VISITOR_KEY || event.key === null) { current.cancel(); refresh(); }
    };
    if (channel) channel.onmessage = refresh;
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storageChanged);
    document.addEventListener("visibilitychange", visible);
    refresh();
    return () => {
      submission.current = null;
      session.current = null;
      current.dispose();
      channel?.close();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storageChanged);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [locale]);

  useEffect(() => {
    if (following.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [state.messages, state.pending, state.partial]);

  function restoreDraft(token: symbol | null) {
    const saved = submittedDraft.current;
    if (!saved || saved.token !== token) return;
    if (draftRevision.current === saved.revision && form.getValues("content") === "") form.setValue("content", saved.text);
    submittedDraft.current = null;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = session.current;
    if (!current || submission.current || busy || capacity.full || !quotaReady || exhausted) return;
    const token = Symbol();
    const text = form.getValues("content");
    const revision = draftRevision.current;
    submission.current = token;
    void form.handleSubmit(async ({ content }) => {
      if (session.current !== current || submission.current !== token) return;
      const sent = await current.submit(content, true, () => {
        submittedDraft.current = { text, revision, token };
        if (draftRevision.current === revision) form.setValue("content", "");
        form.setFocus("content");
      });
      if (session.current !== current || submission.current !== token) return;
      if (!sent) restoreDraft(token);
      else submittedDraft.current = null; // Success must not erase a newer draft.
    })(event).finally(() => {
      if (submission.current === token) submission.current = null;
    });
  }

  function stop() {
    const token = submission.current;
    submission.current = null;
    session.current?.cancel();
    restoreDraft(token);
    form.setFocus("content");
  }

  function clear() {
    const token = submission.current;
    submission.current = null;
    session.current?.clear();
    restoreDraft(token);
    following.current = true;
    form.clearErrors();
    form.setFocus("content");
  }

  const notice = <p id={noticeId} data-chat-notice className="text-center text-[11px] leading-5 text-muted-foreground">
    {!state.consent && <>{t.notice}{" "}</>}
    <Link href="/conditions#conversation-ecrite" className="underline underline-offset-4">{t.terms}</Link>
  </p>;
  const status = state.quotaError === "storage" ? t.storage : state.quotaStatus === "error" ? t.quotaFailed : exhausted ? t.finished : capacity.full || state.error === "history_full" ? t.full : state.error ? t.errors[state.error] : state.status === "sending" ? t.sending : state.status === "sent" ? t.sent : state.status === "cancelled" ? t.cancelled : state.quotaStatus === "loading" ? t.quotaLoading : "";
  const showStatus = exhausted || state.quotaStatus === "error" || capacity.full || state.status === "error" || state.status === "cancelled";
  const historyNodes = useMemo(() => state.messages.map((message, index) => renderMessage(message, index, t.you)), [state.messages, t.you]);
  const messageNodes = state.pending ? [...historyNodes, renderMessage({ role: "user", content: state.pending }, historyNodes.length, t.you), renderMessage({ role: "assistant", content: state.partial }, historyNodes.length + 1, t.you)] : historyNodes;

  return <section data-chat-ui aria-labelledby={titleId} className="mx-auto grid h-[min(62svh,36rem)] min-h-80 w-full max-w-4xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_6rem] sm:grid-rows-1 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_8rem]">
    <div className="order-2 flex min-h-0 min-w-0 flex-col gap-3 sm:order-1">
    <header className="flex shrink-0 items-center gap-3">
      <Image src="/media/demo/noir-listen.webp" alt="" width={480} height={480} sizes="48px" className="size-12 object-contain" draggable={false} />
      <h3 id={titleId} className="text-lg font-light tracking-tight sm:text-2xl">{t.title}</h3>
      {(state.messages.length > 0 || state.pending || state.consent) && <Button type="button" variant="ghost" className="ml-auto size-11 shrink-0 rounded-full text-muted-foreground" aria-label={t.clear} title={t.clear} onClick={clear}><RotateCcw aria-hidden="true" className="size-4" /></Button>}
    </header>
    <div ref={viewport} data-chat-messages role="region" aria-label={t.messages} aria-live="off" tabIndex={0} onScroll={() => {
      const node = viewport.current;
      if (node) following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl px-1 py-3 focus-visible:outline-2 focus-visible:outline-ring">
      {messageNodes.length === 0 ? <div className="flex min-h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <Image src="/media/demo/noir-listen.webp" alt="" width={480} height={480} sizes="112px" className="size-28 object-contain" draggable={false} />
        <p className="text-base font-light sm:text-lg">{t.empty}</p>
        <p className="text-sm text-muted-foreground">{t.intro}</p>
      </div> : <ol className="space-y-5">
        {messageNodes}
      </ol>}
    </div>
    <p role="status" aria-live="polite" aria-atomic="true" className={cn("text-xs leading-5 text-muted-foreground", !showStatus && "sr-only")}>{status}</p>
    {(state.quotaStatus === "error" || state.error === "busy") && <Button type="button" variant="ghost" className="min-h-11 shrink-0 self-start rounded-full text-xs text-muted-foreground" disabled={busy || state.quotaStatus === "loading"} onClick={() => { void session.current?.refreshQuota(); }}>{t.quotaRetry}</Button>}
    {(exhausted || capacity.full) && <div data-chat-complete className="flex shrink-0 flex-wrap gap-2">
      {onContinue && <Button type="button" className="min-h-11 rounded-full px-4" onClick={onContinue}>{t.continue}</Button>}
      <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" onClick={clear}>{t.clear}</Button>
    </div>}
    <Form {...form}>
      <form onSubmit={submit} className="shrink-0 space-y-2" noValidate>
        <FormField control={form.control} name="content" render={({ field }) => <FormItem className="gap-2">
          <FormLabel className="sr-only">{t.message}</FormLabel>
          <div className="rounded-2xl border border-navy/15 bg-background/80 p-3 focus-within:border-navy/40">
            <FormControl><textarea {...field} onChange={event => { draftRevision.current++; field.onChange(event); }} maxLength={MAX_MESSAGE_LENGTH} rows={2} placeholder={t.placeholder} className="max-h-32 min-h-14 w-full resize-y bg-transparent text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground" onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                event.preventDefault();
                if (!busy) event.currentTarget.form?.requestSubmit();
              }
            }} /></FormControl>
            <div className="flex justify-end">
              {busy ? <Button type="button" className="size-11 rounded-full" aria-label={t.stop} title={t.stop} onClick={stop}><Square aria-hidden="true" className="size-4" /></Button> : <Button type="submit" aria-label={state.consent ? t.send : t.agree} aria-describedby={noticeId} title={state.consent ? t.send : t.agree} disabled={!quotaReady || exhausted || !draft.trim() || capacity.full || draft.trim().length > capacity.available} className={cn("min-h-11 rounded-full", state.consent ? "size-11" : "px-4")}>
                {!state.consent && <span>{t.agree}</span>}<ArrowUp aria-hidden="true" className="size-4" />
              </Button>}
            </div>
          </div>
          <FormDescription className="text-[11px] leading-5">{capacity.available} {t.budget}<span className="sr-only">. {t.help}</span></FormDescription>
          <FormMessage />
        </FormItem>} />
      </form>
    </Form>
    {voiceNoticeTarget ? createPortal(notice, voiceNoticeTarget) : notice}
    </div>
    <aside data-chat-counter className="order-1 flex items-center justify-end gap-2 text-navy sm:order-2 sm:flex-col sm:items-start sm:justify-center sm:gap-1 lg:pl-10">
      <p data-chat-remaining aria-live="polite" aria-atomic="true" className="text-4xl leading-none font-light tracking-[-0.075em] tabular-nums sm:-rotate-[5deg] sm:text-6xl lg:text-[5.5rem]">{state.remaining ?? "—"}<span className="sr-only"> {remainingLabel}</span></p>
      <p aria-hidden="true" className="max-w-24 text-[11px] leading-4 font-light text-muted-foreground sm:mt-2">{remainingLabel}</p>
    </aside>
  </section>;
}
