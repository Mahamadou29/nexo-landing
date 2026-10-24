import { DemoApiError, MAX_ASSISTANT_LENGTH, MAX_CHAT_CHARACTERS, MAX_CHAT_MESSAGES, MAX_MESSAGE_LENGTH, getDemoChatQuota, sendDemoChat, type DemoLocale, type DemoMessage } from "./demo-api";
import { getChatVisitorId } from "./demo-chat-visitor";
import { createChatTextReveal, type ChatTextReveal } from "./chat-text-reveal";

export type ChatState = {
  messages: DemoMessage[];
  pending: string;
  partial: string;
  consent: boolean;
  remaining: number | null;
  quotaStatus: "loading" | "ready" | "error";
  quotaError: "storage" | DemoApiError["code"] | null;
  status: "idle" | "sending" | "sent" | "cancelled" | "error";
  error: DemoApiError["code"] | "history_full" | null;
};

export function emptyChat(): ChatState {
  return { messages: [], pending: "", partial: "", consent: false, remaining: null, quotaStatus: "loading", quotaError: null, status: "idle", error: null };
}

/** History capacity is not a visitor's budget. Never infer quota from local messages. */
export function chatCapacity(messages: DemoMessage[]) {
  const remaining = MAX_CHAT_CHARACTERS - messages.reduce((sum, message) => sum + message.content.length, 0);
  const full = messages.length + 1 > MAX_CHAT_MESSAGES || remaining < 1 || messages.some(message => message.role === "assistant" && message.content.length > MAX_ASSISTANT_LENGTH);
  return { full, available: full ? 0 : Math.min(MAX_MESSAGE_LENGTH, remaining) };
}

type Dependencies = {
  send?: typeof sendDemoChat;
  getQuota?: typeof getDemoChatQuota;
  getVisitor?: typeof getChatVisitorId;
  onSettled?: () => void;
  reveal?: typeof createChatTextReveal;
};

/** Owns requests and transient turns. Only the server can grant remaining replies. */
export class DemoChatSession {
  private state = emptyChat();
  private request: AbortController | null = null;
  private reveal: ChatTextReveal | null = null;
  private quotaRequest: AbortController | null = null;
  private quotaDirty = false;
  private visitorId: string | null = null;
  private disposed = false;
  private readonly locale: DemoLocale;
  private readonly onState: (state: ChatState) => void;
  private readonly deps: Required<Dependencies>;

  constructor(locale: DemoLocale, onState: (state: ChatState) => void, deps: Dependencies = {}) {
    this.locale = locale;
    this.onState = onState;
    this.deps = { send: sendDemoChat, getQuota: getDemoChatQuota, getVisitor: getChatVisitorId, onSettled: () => {}, reveal: createChatTextReveal, ...deps };
  }

  private publish(patch: Partial<ChatState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.onState(this.state);
  }

  private notifyOtherTabs() {
    try { this.deps.onSettled(); }
    catch { /* Optional browser messaging must not turn a completed reply into a failure. */ }
  }

  async refreshQuota(): Promise<void> {
    if (this.disposed) return;
    if (this.request) { this.quotaDirty = true; return; }
    this.quotaDirty = false;
    this.quotaRequest?.abort();
    const current = new AbortController();
    this.quotaRequest = current;
    this.publish({ quotaStatus: "loading", quotaError: null });
    try {
      const visitorId = this.deps.getVisitor();
      // Never silently switch an active page to a freshly generated budget.
      if (this.visitorId && visitorId !== this.visitorId) throw new Error("Visitor changed");
      this.visitorId = visitorId;
    } catch {
      this.quotaRequest = null;
      this.publish({ remaining: null, quotaStatus: "error", quotaError: "storage" });
      return;
    }
    try {
      const remaining = await this.deps.getQuota({ visitorId: this.visitorId, signal: current.signal });
      if (!this.disposed && this.quotaRequest === current) this.publish({ remaining, quotaStatus: "ready", quotaError: null });
    } catch (error) {
      if (!this.disposed && this.quotaRequest === current) this.publish({ remaining: null, quotaStatus: "error", quotaError: error instanceof DemoApiError ? error.code : "network" });
    } finally {
      if (this.quotaRequest === current) this.quotaRequest = null;
    }
  }

  async submit(draft: string, agree: boolean, onAccepted?: () => void): Promise<boolean> {
    if (this.disposed || this.request || !this.visitorId || this.state.quotaStatus !== "ready" || this.state.remaining === null) return false;
    try { if (this.deps.getVisitor() !== this.visitorId) throw new Error("Visitor changed"); }
    catch { this.publish({ remaining: null, quotaStatus: "error", quotaError: "storage" }); return false; }
    const content = draft.trim();
    const capacity = chatCapacity(this.state.messages);
    const error = this.state.remaining === 0 ? "exhausted" : !this.state.consent && !agree ? "consent" : capacity.full ? "history_full" : !content || content.length > capacity.available ? "limit" : null;
    if (error) { this.publish({ status: "error", error }); return false; }
    const current = new AbortController();
    this.request = current;
    const ownsRequest = () => !this.disposed && this.request === current && !current.signal.aborted;
    const messages: DemoMessage[] = [...this.state.messages, { role: "user", content }];
    this.publish({ pending: content, partial: "", consent: true, status: "sending", error: null });
    onAccepted?.();
    let reveal: ChatTextReveal | null = null;
    try {
      reveal = this.deps.reveal(partial => { if (ownsRequest()) this.publish({ partial }); });
      this.reveal = reveal;
      const reply = await this.deps.send({ locale: this.locale, visitorId: this.visitorId, messages, consent: true, signal: current.signal, onText: partial => {
        if (ownsRequest()) reveal?.push(partial);
      } });
      if (!ownsRequest()) return false;
      if (!reply.text.trim() || reply.text.length > MAX_ASSISTANT_LENGTH) throw new DemoApiError("response");
      await reveal.finish(reply.text);
      if (!ownsRequest()) return false;
      this.publish({ messages: [...messages, { role: "assistant", content: reply.text }], remaining: reply.remaining, pending: "", partial: "", status: "sent" });
      this.notifyOtherTabs();
      if (this.quotaDirty) { this.request = null; void this.refreshQuota(); }
      return true;
    } catch (error) {
      if (ownsRequest()) {
        this.request = null;
        this.publish({ pending: "", partial: "", status: "error", error: error instanceof DemoApiError ? error.code : "network" });
        void this.refreshQuota(); // Reconcile completed replies after reservation release; never increment locally.
        this.notifyOtherTabs();
      }
      return false;
    } finally {
      reveal?.dispose();
      if (this.reveal === reveal) this.reveal = null;
      if (this.request === current) this.request = null;
    }
  }

  cancel() {
    const current = this.request;
    this.request = null;
    this.reveal?.dispose();
    this.reveal = null;
    current?.abort();
    if (current && !this.disposed) {
      this.publish({ pending: "", partial: "", status: "cancelled", error: null });
      void this.refreshQuota();
      this.notifyOtherTabs();
    }
  }

  clear() {
    this.cancel();
    this.publish({ messages: [], pending: "", partial: "", status: "idle", error: null });
    // Clearing never resets the visitor, consent, or budget.
  }

  dispose() {
    this.disposed = true;
    this.reveal?.dispose();
    this.reveal = null;
    this.quotaRequest?.abort();
    this.quotaRequest = null;
    const active = this.request;
    this.request = null;
    active?.abort();
    if (active) this.notifyOtherTabs();
  }
}
