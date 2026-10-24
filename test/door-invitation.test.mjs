import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { doorInvitations } from "../lib/door-invitation.ts";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const doors = readFileSync(new URL("../components/doors.tsx", import.meta.url), "utf8");
const invitationCss = css.slice(css.indexOf(".door-invitation-stage {"), css.indexOf("@property --nexo-portal-angle"));

test("FR invitations use the requested four beats and correct peut", () => {
  assert.deepEqual(doorInvitations.fr.ciel, ["Découvrir", "ce que", "Nexo", "peut faire."]);
  assert.deepEqual(doorInvitations.fr.noir, ["Vis", "un moment", "avec", "Nexo."]);
});

test("EN invitations preserve meaning in four localized beats", () => {
  assert.deepEqual(doorInvitations.en.ciel, ["Discover", "what", "Nexo", "can do."]);
  assert.deepEqual(doorInvitations.en.noir, ["Share", "a moment", "with", "Nexo."]);
  const descriptions = [
    "Découvrir ce que Nexo peut faire.", "Vis un moment avec Nexo.",
    "Discover what Nexo can do.", "Share a moment with Nexo.",
  ];
  assert.deepEqual(Object.values(doorInvitations).flatMap(locale => Object.values(locale).map(chunks => {
    assert.equal(chunks.length, 4);
    assert.ok(chunks.every(chunk => chunk.trim() === chunk && chunk.length > 0));
    return chunks.join(" ");
  })), descriptions);
});

test("CSS stamps arrive in a quick cadence and finish with dust in under 700ms", () => {
  const delays = [...invitationCss.matchAll(/--stamp-delay: (\d+)ms/g)].map(match => Number(match[1]));
  assert.deepEqual(delays, [0, 130, 260, 390]);
  assert.match(invitationCss, /var\(--stamp-animation\) 220ms[^;]+ 1 both/);
  assert.match(invitationCss, /var\(--dust-animation\) 260ms ease-out calc\(var\(--stamp-delay\) \+ 45ms\) 1 both/);
  assert.ok(delays.slice(1).every((delay, index) => delay - delays[index] === 130));
  assert.equal(delays.at(-1) + 45 + 260, 695);
  assert.match(invitationCss, /20% \{ opacity: 1; transform: translateY\(1px\) scale\(0\.96, 0\.92\)/);
  assert.equal((invitationCss.match(/\.door-stamp-dust > :nth-child\(/g) ?? []).length, 6);
});

test("hidden CSS cancels beats rather than pausing or endlessly repeating them", () => {
  assert.match(invitationCss, /\.door-invitation \{\s*--stamp-animation: none;\s*--dust-animation: none;/);
  assert.doesNotMatch(invitationCss, /infinite|animation-play-state|transition:/);
  for (const door of ["ciel", "noir"]) {
    assert.ok(invitationCss.includes(`.door-options:has([data-door="${door}"]:focus-visible) [data-invitation="${door}"]`));
    assert.ok(invitationCss.includes(`.door-options:not(:has(.avatar-door:focus-visible, .avatar-door:active)):has([data-door="${door}"]:hover) [data-invitation="${door}"]`));
  }
});

test("invitations sit at the bottom of a viewport-sized entrance with centered avatars", () => {
  assert.match(invitationCss, /grid-row: 2/);
  assert.match(invitationCss, /align-self: end/);
  assert.match(css, /\.entrance-shell \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: clip/);
  assert.match(css, /top: calc\(50dvh - var\(--entrance-header-height\)\)/);
  assert.match(css, /\.entrance-shell > footer \{[\s\S]*?overflow-y: auto/);
  assert.match(invitationCss, /color: var\(--navy\)/);
  assert.match(invitationCss, /color: var\(--ring\)/);
  assert.match(invitationCss, /grid-area: 1 \/ 1/);
  assert.match(invitationCss, /flex-wrap: wrap/);
  assert.match(invitationCss, /overflow-wrap: anywhere/);
  assert.doesNotMatch(doors, /absolute top-full|onClick=|onTouch/);
});

test("descriptions are complete and persistent; visual beats are decorative and reduced motion is immediate", () => {
  assert.match(doors, /aria-describedby=\{`door-invitation-\$\{door.image\}`\}/);
  assert.match(doors, /id=\{`door-invitation-\$\{door.image\}`\} className="sr-only">\{doorInvitations\[locale\]\[door.image\]\.join\(" "\)\}/);
  assert.match(doors, /className="door-invitation-stage text-center text-navy" aria-hidden="true"/);
  assert.doesNotMatch(doors, /aria-live|role="status"|Audio|useEffect|requestAnimationFrame/);
  assert.match(invitationCss, /prefers-reduced-motion: reduce[\s\S]*\.door-stamp-ink \{ animation: none; \}[\s\S]*\.door-stamp-dust \{ display: none; \}/);
});
