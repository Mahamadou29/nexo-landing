# Détente · /experience

`components/relaxation.tsx` is the reusable client leaf; `lib/relaxation.ts` owns the testable clock, original bilingual phrases and local audio lifecycle. No backend, chat quota/reveal, provider, library or audio asset changes.

## Presentation

- Rose stays fixed inside four fine, distinctly asymmetric and lobed SVG ripples using existing `--sky`, `--voice-cell-2` and `--navy` tokens. No filled blobs or circular frame. Like raindrops on water, each ring expands from the same center and fades away over 5.6 seconds; four staggered phases emit a ripple every 1.4 seconds during playback. Non-scaling strokes keep the rings delicate at every size. Idle/stopped/reduced-motion states retain static rings, with no repeating animation or extra JavaScript timer.
- Five original, unattributed FR/EN phrases crossfade and drift every 24 seconds. Large, balanced typography alternates contrasting Nexo ink/blue/blue-gray tokens. Individual words sway gently like leaves, with staggered cycles only during playback. The slideshow and visible 2:00 timer share the same monotonic deadline. No frame-by-frame page state: the leaf receives only changed whole seconds/slide/status.
- Desktop: smaller companion left, prominent quotes right. Mobile: companion above quotes. A compact wrapping control bar groups the timer, single start/stop action, volume and a keyboard-accessible sound information disclosure. Routine instructions/status stay screen-reader accessible without cluttering the view; audio errors remain visible. The relaxation scene fills the dynamic viewport without page or panel scrolling. Quotes and companion scale with the available panel dimensions; short landscape screens use a side-by-side layout. Mobile hides the redundant introduction and keeps the activity tabs, legal links and step navigation in the viewport. These shared viewport constraints apply while relaxation or breathing is mounted, leaving chat, voice and forms unchanged.
- The clock occupies a fixed-width slot (4rem on mobile, 5rem from 640px), so proportional digit changes never shift the neighboring controls. The action button keeps a fixed 11rem width across start, stop, restart and retry in both languages. Existing Nexo tokens distinguish states: navy to start, muted brick to stop, sky blue to restart/retry. During the short stop fade, its visible label stays compact while its accessible label describes the fade.
- Reduced motion: static waves/words and instant phrase replacement, including preference changes mid-session. The companion never moves. `role="timer"` uses `aria-live="off"`; polite announcements only change with session status. Only the current phrase is exposed to assistive technology.

## Lifecycle / privacy

- Nothing plays on mount. Only the explicit **Commencer / Begin** gesture creates/resumes an AudioContext; its accessible label and description explain the sound. Default volume 20%; native labelled range includes mute at 0%.
- The local ambient bed uses two sine tones (174/261 Hz) with slow, shallow amplitude modulation. Separate level/envelope gains preserve the scheduled ending when volume changes. No recording, microphone, storage, fetch, media download or provider call.
- `performance.now()` deadline starts when audio is running. Visual ticks catch up after delays; the audio thread independently fades over the final 1.2 seconds and stops all oscillators at 120 seconds. Audio `ended` also completes the UI if JS ticks are delayed.
- Manual stop fades for 180 ms, then disconnects nodes and closes the context. Restart is disabled until cleanup finishes. Stopped sessions freeze their timer/phrase; a new explicit start resets both to a fresh two minutes. Completion is restartable (unlike the chat quota).
- **Stop, not pause**, on `visibilitychange` to hidden, `pagehide`, activity/step departure, locale change or unmount, matching voice's hidden-tab convention. These paths silence/disconnect immediately; no fade or secret background playback, no automatic resume on return. Hiding during a manual fade releases its timer immediately.
- Resume timeout (10 s), rejected resume, unsupported WebAudio, partial graph failures and unexpected context suspension/closure stop cleanly and expose a retry. Stale resume promises cannot resurrect sound.
- A module-level context lease also guards rapid remounts: no new context while an old one is closing. A rejected close leaves output disconnected and keeps the lease until that context is actually closed; retry cannot introduce overlapping audio. A browser that cannot release its context may need a page reload.
- Disposal suppresses later React updates, clears timers/listeners, detaches audio callbacks, stops sources and disconnects nodes. No resources are acquired during render.

## Focused validation

Run without building or restarting the parent-owned preview:

```bash
node --test test/relaxation.test.mjs test/relaxation-ui.test.mjs test/demo-chat*.test.mjs test/experience-flow.test.mjs test/mobile-layout.test.mjs test/realtime-voice-ui.test.mjs
npx tsc --noEmit
npm run lint
```

The dependency-free Node/TSX adapter tests execute actual component handlers and lifecycle code with a controlled monotonic clock and fake WebAudio graph. They cover original slides/deadlines, hard cutoff, smooth gain scheduling, muted level, repeat start, late resume, timeout/retry, partial failures, interruption, disposal, close serialization, hidden/pagehide/unmount, accessible controls, locale keys and reduced-motion styling. This is not an acoustic or real-browser playback certification.

Parent-owned browser smoke checks (FR/EN, desktop/short desktop, 390 px mobile, 200% zoom, reduced motion):

1. Open `/experience` → activities → `[data-activity="relaxation"]`. Confirm no sound before the start gesture.
2. Inspect `[data-relaxation-ui]`, `[data-relaxation-stage]`, `[data-relaxation-waves]`, `[data-relaxation-companion]`, `[data-relaxation-clock] [role="timer"]`.
3. Activate `[data-relaxation-toggle]`; check `data-state="playing"`, low audible ambient sound, stable portrait, smooth waves. At 24 s `[data-relaxation-phrase="1"][data-active="true"]` is visible and timer reads 1:36. `[data-relaxation-volume]` supports keyboard arrows and mute.
4. At 120 s expect `data-state="complete"`, 0:00, silence, working restart. Manual stop should fade without clicking or overlaps.
5. Hide/return, change activity, change FR/EN, leave the step, or navigate away while starting/playing/stopping: expect silence and no automatic restart. Retry after a simulated output failure.
6. Reduced motion keeps the waves static, replaces phrases without motion/fade, and preserves all controls. Timer does not announce every second; labels and status remain readable. Confirm no page or panel scrolling in either direction and no clipped quotes, controls or information disclosure. Check 320×568 and 390×844 portrait, 667×375 landscape, 820×900 tablet, and 1440×650/900 desktop; leaving relaxation must restore the other activity layouts.
