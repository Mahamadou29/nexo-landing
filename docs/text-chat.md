# Experience text chat

`ActivityPanel` mounts `components/demo-chat.tsx` only for the enabled Chat tab. Voice, breathing, relaxation, feature flags and navigation remain independent. The obsolete recorded-note `Conversation` implementation is removed.

## Interaction and consent

- The first explicit form submission uses **Accepter et envoyer / Agree and send**. Typing never sends content; mounting and returning to a tab check the allowance without sending a transcript.
- A short processing notice and `/conditions#conversation-ecrite` link use the existing footer `voiceNoticeTarget` portal (visible local fallback). Following submissions use an icon **Envoyer / Send** control and retain the terms link. No checkbox or provider badge.
- Consent and messages live only in component memory. **Effacer la conversation / Clear conversation** removes history, not the visitor ID, consent or quota. Leaving the activity or changing locale/route aborts requests and discards in-memory messages; the next mount reloads the server quota before enabling Send.
- Enter submits; Shift+Enter adds a newline. Composition events and Safari's keyCode 229 do not submit. Status announcements describe lifecycle changes, never every streamed token.
- Pending replies show three asymmetrical SVG cells in the existing sky-to-ink palette, gently breathing out of phase (static with reduced motion). The typing text is screen-reader-only. User messages retain content-width rounded bubbles; Nexo’s text has no frame or background and keeps the same available width throughout streaming to avoid a growing, reflowing bubble.
- `lib/chat-text-reveal.ts` buffers irregular provider chunks and reveals graphemes on animation frames at an eased, adaptive cadence (65–180 graphemes/second while streaming). A final backlog drains within 1.5 seconds, without dumping the completed response in one paint. Stable word spans add a subtle 180ms opacity fade without blur, movement or reanimating earlier words. Accents, joined emoji, spaces and line breaks are preserved.
- Reduced motion or a hidden browser tab bypasses the visual delay; returning to the page never replays an accumulated queue. Stop, clear, error and unmount cancel queued frames and remove visibility/motion listeners. Completion commits the exact server response only after the visible tail finishes; cancelling that tail cannot refund a reply already completed on the server.
- The message viewport follows updates only while its reader is within 80px of the bottom. The composer stays below the scrolling messages; short screens retain the existing page/panel scrolling fallback.

## Request ownership and retry

`lib/demo-chat.ts` owns a single `AbortController`. A submitted user message appears immediately, alongside the streaming reply. Neither enters committed history until the entire response succeeds. Stop, clear, unmount and owner replacement invalidate callbacks before aborting. Late tokens, resolutions and failures cannot affect a newer request.

The form locks before asynchronous Zod validation, preventing double submits. The composer clears immediately when the session accepts the submit, not when its reply completes. A separately retained submitted draft is restored after error/cancel only if the user has not edited since submission and the composer is still empty. Users can type their next draft during streaming; success never erases it. Typing then deleting also counts as a newer draft. Stopping cannot recall content already sent.

`sendDemoChat` posts `{ visitor_id, locale, messages, consent: true }` to `/api/v1/landing/demo/chat`, with `Accept: text/plain, application/json`. It consumes plain text with ERROR sentinel handling, and returns `{ text, remaining }` only after the complete stream succeeds. There are no canned replies, automatic content retries, new libraries, or frontend transcript persistence.

## Limits

The frontend matches the expanded backend contract: `MAX_CHAT_REPLIES = 15`, `MAX_CHAT_MESSAGES = 29`, and `MAX_CHAT_CHARACTERS = 120_000`. No backend files were changed.

- **No chat timer.** The large right-side number shows replies remaining, not time. From 1,024px, 40px of inset shifts the count and its label further right within their reserved column, without changing the message width. On small screens it remains a compact count above the chat. FR/EN labels handle singular and plural.
- The count starts **unknown**, never optimistically at 15. Initialization must fetch a valid server allowance before sending. A successful stream uses its authoritative `X-Nexo-Chat-Remaining` header, not a locally computed decrement. Failures/cancellations refresh quota through a quota POST; pending reservations never reduce the lookup result and the frontend never adds a reply locally.
- User message: 2,000 characters; assistant history: 6,000.
- Request: at most 29 messages, alternating user/assistant and ending with user; at most 120,000 total characters. The 15th request can include all 14 earlier pairs plus the final user message, even at every per-message maximum (114,000 input characters).
- All completed messages remain visible until explicitly cleared (up to 30 messages / 120,000 characters). The server allowance may be exhausted after fewer turns in this page because earlier conversations/tabs already consumed it. A zero allowance disables Send even with empty history. History is never silently truncated.
- At zero, the completion controls offer the existing journey's signup step via `onChatContinue`. Clearing history does not renew the allowance or enable Send. Navigation is never automatic.
- The existing per-request timeout protects a stalled request; it is not a chat countdown or a session-duration limit.
- HTTP 429 with `{error: "chat_exhausted"}` means lifetime visitor exhaustion; other 429s are transport rate limits. HTTP 409 with `{error: "chat_busy"}` means another active request for this visitor. 413 is a content limit; 503 is temporary unavailability. These are distinct from local history-full feedback.

## Visitor storage and quota contract

- The separate localStorage key **nexo.chat.visitor.v1** holds only a random UUID. It is not the optional analytics ID, an account, or a browser fingerprint. No quota or transcript is stored locally.
- Normal/force reloads, language changes, tabs, clearing messages and analytics opt-out do not remove this ID. Clearing browser site storage or using a new browser can inherently create a new identity; it does not delete the previous server counter. Terms and privacy disclose this pseudonymous storage and lifetime budget.
- Storage denial, invalid stored ID, failed persistence or unavailable UUID generation disables chat with an actionable storage error. There is no in-memory identity fallback.
- POST **/api/v1/landing/demo/chat/quota** with JSON **{visitor_id: <UUID>}** must return **{remaining: integer 0..15}**. The UUID is never put in the request URL; this lookup includes no conversation content and invokes no provider. Failed/malformed quota responses disable Send and expose a retry control, never a default allowance.
- POST requires **visitor_id**. Streams must include **X-Nexo-Chat-Remaining**, the projected remaining count if this reply completes successfully. Apply it only after the entire stream succeeds, never on headers or partial text. Missing or malformed headers fail closed.
- **Backend CORS must expose X-Nexo-Chat-Remaining** via Access-Control-Expose-Headers, allow both JSON POST endpoints from the frontend origin. Without the exposed header, browser JavaScript cannot read the quota even when curl can.
- The existing server JSON body cap is 512 KiB; history and role limits remain unchanged. The independent 6/min chat-send rate limit is not a lifetime quota. Quota POST should remain available for initialization/refund checks.
- Focus/visibility and BroadcastChannel notifications refresh other tabs. Late quota responses are ownership-guarded; refreshes during an active stream are deferred until it settles. No polling or countdown is used.
- Quota lookup counts only completed replies, not pending reservations. Failed, empty, truncated or cancelled streams release the active reservation without consuming a reply. The frontend rechecks quota automatically after failure/cancel. There is no manual allowance-check button beside the counter; a **Réessayer / Try again** control appears with quota-loading errors or a concurrent-request error only. A temporary 409 can occur until an active reservation is released; this does not mean exhaustion.
- The backend stores only the visitor UUID, completed reply count and transient reservation, not transcripts or IP addresses in this quota model. The budget row is retained for demo enforcement with no expiry or automatic deletion. Server restarts preserve the database count; clearing localStorage does not delete that server row. Its 90-second stale-reservation lease is a concurrency safeguard, not a conversation timer; stale streams must not deliver or complete after a successor. The local schema migration is a separate backend integration prerequisite.
- No backend files were changed. No server restart or production build was run.

## Focused checks (no build/server restart)

```sh
node --test test/chat-text-reveal.test.mjs test/demo-api.test.mjs test/demo-chat.test.mjs test/demo-chat-ui.test.mjs test/demo-chat-quota.test.mjs test/demo-chat-drafts.test.mjs test/demo-chat-visitor.test.mjs test/experience-flow.test.mjs test/realtime-voice-ui.test.mjs
npx tsc --noEmit
npm run lint
```

Tests execute the actual session and TSX handlers via the project's Node/TypeScript transpile adapters, with inert React/form/browser bindings and real Zod validation. They cover consent, validation, streaming, duplicate submissions, failure/abort retries, stale ownership, disposal, keyboard/IME behavior, scroll following, limits and HTTP mappings. They are not end-to-end backend or visual browser tests; backend activation and final integrated build remain separate.
