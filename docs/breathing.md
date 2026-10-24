# Breathing experience

`components/breathing.tsx` replaces the inline demo exercise. FR/EN copy, two eager-loaded local Ciel poses, a borderless organic guide, expressive phase text, one fixed 11rem action, and a remaining-time clock. The optional information disclosure contains gentle guidance and local-only/privacy details; Escape or its close button closes it and restores focus.

## Session

- Nothing starts on mount. Begin starts a fresh 60-second session: six cycles of 4-second gentle inhalation and 6-second exhalation, without holds.
- Stop freezes the clock and visual immediately. Start again begins at 1:00, not midway through a breath. The button is navy initially, destructive while running, and sky after stopping or completing.
- The total countdown has its own fixed-width slot (3rem on mobile, 5rem from 640px); changing digit widths cannot move the action button.
- The aura grows from ×0.69 to ×2.2 during inhalation, well beyond Ciel and behind the written guide, then contracts during exhalation. Its opacity decreases as it expands, preserving text contrast. Only the decorative SVG overflows its stage. The breathing panel and demo wrapper allow horizontal paint beyond their edges, avoiding a straight cut through the enlarged aura. Vertical clipping protects navigation and controls; the outer fullscreen shell still clips at the viewport without adding scroll.
- A single monotonic clock in `lib/breathing.ts` supplies the phase, phase countdown, total countdown, and SVG expansion. Expansion follows a continuous cosine curve over each complete phase; no independent CSS animation can drift from it. React receives only changes to displayed seconds/phase/status; SVG attributes receive visual frames.
- Delayed frames catch up to elapsed time. The final frame contracts the guide and cancels further scheduling. Duplicate starts and stale callbacks cannot create another loop.
- Hidden tabs and `pagehide` stop the session, with no automatic resume. Activity, locale, experience-step navigation and unmount dispose the RAF and event listeners. Locale is also an explicit component key.
- Reduced motion keeps the organic guide static, removes pose transitions, and retains the written phase/countdowns. Live preference changes are supported. The phase alone is politely announced; neither countdown repeatedly interrupts assistive technology.
- No audio, microphone, network request, persistent storage, dependency, or backend is involved.

## Shared fullscreen fitting contract

Breathing paint and inner container fitting are imported from `components/breathing.css`. The parent-owned shared shell in `app/globals.css` supplies `.demo-panel { container-type: size }` and the breathing-only horizontal overflow allowance. The breathing root fills 100% height with flex:1/min-height:0. cqw/cqh size the typography and organic stage; narrow tall panels stack, short panels retain two columns and omit only the secondary caption. The 11rem action and 44px targets remain intact even in a 127px-high panel.

| Hook | Purpose |
| --- | --- |
| `[data-breathing-ui]` | Root flex column; `data-state` idle/running/stopped/complete, `data-phase` inhale/exhale; min-height/min-width zero |
| `[data-breathing-layout]` | Main grid, visual then text; stacked small, two columns from md |
| `[data-breathing-stage]` | Aspect 6/5 organic visual area; default max-width 14rem / md 24rem |
| `[data-breathing-organic]` | SVG fills the stage; aura expands beyond its viewBox beneath the foreground guide |
| `[data-breathing-companion]` | Two layered poses, default 8rem / md 12rem |
| `[data-breathing-guide]` | Text column, no minimum height |
| `[data-breathing-phase]` | Two-line expressive phase; fluid type, leading 1.08 |
| `[data-breathing-caption]` | One quiet line of state/safety copy |
| `[data-breathing-phase-time]` | Optional-to-layout visual seconds within this phase |
| `[data-breathing-controls]` | Shrink-zero centered wrapping row, relative disclosure anchor |
| `[data-breathing-clock]` | Total countdown, timer role with live updates off |
| `[data-breathing-toggle]` | 11rem, minimum 44px touch target; data-action start/stop/restart |
| `[data-breathing-info]`, `[data-breathing-notice]` | Native top-layer popover, constrained to viewport width/height; escapes shell clipping |

The component sizes/centers the main grid and shrinks the stage, companion, type and gaps together within the shared size container, retaining the controls. The information popover renders in the browser top layer rather than being clipped by the panel. Browser verification: no panel overflow at 1440×900, 390×844, 320×568, 844×390 or 1024×600; a simulated 127px panel retains the entire two-line phase and 176×44px action. Its information popover fits the viewport without internal scrolling.

## Verification

`node --test test/breathing.test.mjs test/experience-flow.test.mjs` covers phase boundaries, continuous expansion, monotonic catch-up, manual start/stop/restart/completion, duplicate/stale callbacks, frame cleanup, hidden/page lifecycle, component cleanup boundaries, reduced motion, accessible controls and the extracted asset integration.

`npx tsc --noEmit` and `npm run lint` validate the project. No build or server restart is required by this change.
