# Homepage typography

## Copy and sequencing

- **48 entries per locale (FR / EN):** 32 original encouragements, 16 original editorial remixes. Both sides of each remix are original copy, not attributed quotations or adaptations of modern quotations.
- The original Respire / Ressens / Sois toi and Breathe / Feel / Be yourself remain in the pool.
- English copy preserves each French entry’s intent in natural, welcoming language, rather than substituting unrelated slogans. Examples: « À ton écoute » → “Here to listen”, « Souffle » → “Take a breath”, « Tu as le droit de ralentir » → “It’s okay to slow down”. Read each remix both before and after replacement: both versions remain complete, and the crossed-out/replacement contrast matches the French. French wording and the animation system are unchanged.
- Remixes use plain `before`, `struck`, `replacement`, and optional `after` fragments. No HTML injection. No attribution label is displayed in either locale.
- The old fragment appears first; its strike is drawn at 2.7 seconds; the replacement arrives after 3.35 seconds. Exits begin at 8.5 seconds, leaving a reading hold.
- A Fisher–Yates copy bag visits all 48 entries before refilling. There are no adjacent duplicate entries or families, including bag seams. Palette and exit bags also avoid immediate repeats. Randomness is injectable in tests.

## Choreography

Seven families:

1. `zoom`: original independent ×8–×11 glyph flights, solid off-camera exits.
2. `lateral`: independent letter fans at varying heights.
3. `fold`: alternating horizontal/vertical glyph creases.
4. `evaporate`: original glyph-local erosion masks.
5. `stamp`: coloured paper word tiles, angled impact, rebound, and three edge treatments.
6. `stairs`: measured word rows, thin stepped rails, three successive descending landings per word.
7. `wall`: refined outline drawing and left-to-right ink reveal, a slim advancing drawing edge, and three type treatments. No splashes, spray, or animated noise filters.

The 16 short entries in each locale rotate through the four letter families. The 32 longer entries/remixes rotate through the three phrase families. Phrase exits independently rotate through `lift`, `peel`, `slide`, and `erase`, with randomized direction and three treatments. Four palettes (`sky`, `sage`, `amber`, `ink`) derive entirely from existing Nexo tokens.

## Lifecycle and layout

Only **one scene and one GSAP timeline** exist at a time, with a 14-second passage. Completing a passage mounts the next scene; it does not retain a timeline for the entire copy pool. Current limits: 12 animated letters or 10 FR / 9 EN word units. Only evaporation scenes allocate erosion masks. No custom timers, animation frames, particles, or DOM clones.

Font readiness precedes SVG measurement. Long copy wraps into centered measured rows; phrase canvases fit the viewport while the original giant-letter canvas retains its wider framing. Stair rows are capped at three words.

The layer is decorative (`aria-hidden`, non-focusable SVG, `pointer-events: none`, z-index 0). Existing stationary avatars, portal hover/focus effects, fast bottom invitations, footer navigation, links, analytics, and fullscreen shell are unchanged.

Reduced motion prevents mounting the animation component and downloading GSAP. Manual pause survives locale changes and tab visibility changes. Hidden tabs pause the current timeline; resuming never overrides the user's pause choice. Locale/unmount cleanup cancels pending font/import initialization, removes the visibility listener, and reverts the GSAP context. Optional animation initialization failures leave the links usable.

## Door-to-route organic opening

`DoorTransitionScope` persists inside `LandingProvider`, without adding a layout wrapper. Only the two home `DoorLink`s opt in. The avatar itself stays stationary: a separate SVG membrane grows from the measured `[data-avatar]` center, then opens an organic aperture onto the **committed, hydrated** destination. Both membranes use the existing background/sky/navy tokens, with a restrained `portal-ciel` or `portal-noir` tint. There are no snapshots, cloned scenes, remote assets, new dependencies, or global route fades.

Timing is **1000 ms cover + 1400 ms opening** (2400 ms, plus two paint frames for Next's scroll/focus pass). A gradual `cubic-bezier(.45,0,.25,1)` onset avoids the previous rapid expansion; the longer opening lets the destination emerge slowly. Navigation starts only behind the opaque membrane. Page/error readiness sentinels, rather than pathname alone, gate the reveal. A **3000 ms watchdog** removes the decorative shield even if navigation or animation stalls. If the home has not yet committed away, a localized, non-blocking loading bridge replaces the home doors instead of flashing them back; its real “Return to both doors” link and shared navigation remain usable. Once Next commits, its existing loading/error/content UI takes over. Late hydration receives guarded focus but never replays the animation.

The installed Next App Router `Link` / `useRouter`, loading and view-transition documentation were consulted. This uses stable `onNavigate` + WAAPI/SVG rather than coupling route readiness to a browser snapshot or adding configuration. Real hrefs and automatic prefetch remain intact. Next handles modifiers, middle-click, new tabs, downloads and keyboard Enter. No JS, reduced motion, hidden-tab activation or unavailable WAAPI use ordinary navigation immediately.

Only one transition owns navigation. Duplicate door clicks are absorbed; history, unrelated link navigation and unmount invalidate old callbacks. Resize, hiding the tab, switching to reduced motion, Tab or Escape finish the navigation intent without replay. All animations, deadlines, paint frames and listeners are cancelled. No body scroll styles, inert state or persistent pointer shield are installed. Next's scroll/focus behavior stays enabled; fallback destination focus is applied only if focus is still on the old door or body, never over a user's focus in navigation or page controls. Analytics remain the existing provider's rendered-route events, not click/animation events. Discovery's single header, signup, GSAP scenes and experience activities are unchanged.

Transition inspection selectors:

- `[data-door="ciel"]`, `[data-door="noir"]`, `[data-avatar]`
- `[data-door-transition]`: `data-phase="idle|covering|waiting|revealing"`, `data-character="ciel|noir"`
- `.door-cell-cover`, `.door-cell-opening`
- `[data-door-route-ready="/decouvrir"]`, `[data-door-route-ready="/experience"]`
- `[data-door-pending]` (slow-network bridge only)

Focused regression command (no servers or real submissions):

```bash
node --test test/door-transition.test.mjs test/door-invitation.test.mjs test/discovery.test.mjs test/entrance-motion.test.mjs test/entrance-typography.test.mjs test/mobile-layout.test.mjs test/landing.test.mjs
```

The transition tests exercise the actual lifecycle controller, viewport coverage, serialized navigation/readiness, cancellation races, watchdog/late focus, failures, link rendering and the installed Next Link native-navigation guards. Fallback focus selects a visible heading, ignoring cached hidden routes. Its temporary `tabindex="-1"` remains until blur so Chromium does not drop focus back to the body; existing tabindex values remain unchanged. Browser verification covers both destinations and viewports from 320 to 1440 px, including short landscape. Use an active browser context: an occluded IDE tab can throttle animation frames to 1 Hz and intentionally trigger the watchdog instead of the normal reveal.

## Inspection selectors

- `.entrance-atmosphere`, `.entrance-canvas`, `.entrance-motion-control`
- `[data-entrance-scene]`: `data-entry`, `data-family`, `data-exit`, `data-palette`, `data-variation`
- `[data-letter-flight]`, `[data-letter-shape]`, `[data-letter-ink]`
- `[data-type-unit]`: `data-role="before|struck|replacement|after"`
- `[data-stamp-paper]`, `[data-stair-rail]`
- `[data-wall-outline]`, `[data-wall-pen]`, `[data-type-reveal]`
- `[data-type-strike]`

## Verification

```bash
node --test test/entrance-motion.test.mjs test/entrance-typography.test.mjs test/door-invitation.test.mjs
npx tsc --noEmit
npm run lint
```

The focused suite contains 22 tests: original flight geometry, expanded timing bounds, copy structure, seeded shuffle coverage/seams, measured-layout arithmetic, actual animation-builder operations against SVG stand-ins, lifecycle guards, pause/visibility behavior, and unchanged invitation/fullscreen contracts. Animation-builder tests transpile in memory; no build or preview server is needed.

Browser visual verification remains with the parent task; production compilation is checked with `npm run build`. No preview server is started or restarted by this change.
