import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adjacentExperienceStep, experienceSteps } from "../lib/experience-flow.ts";

const experience = readFileSync(new URL("../components/experience.tsx", import.meta.url), "utf8");
const stamp = readFileSync(new URL("../components/mood-stamp.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const provider = readFileSync(new URL("../components/landing-provider.tsx", import.meta.url), "utf8");
const breathing = readFileSync(new URL("../components/breathing.tsx", import.meta.url), "utf8");
const demo = readFileSync(new URL("../components/demo-activities.tsx", import.meta.url), "utf8");

test("local video auto-starts, resets per language and fades into demo; remote embeds retain their gate", () => {
  const video = readFileSync(new URL("../components/introduction-video.tsx", import.meta.url), "utf8");
  assert.match(experience, /introductionVideo\(config.video_url, locale\)/);
  assert.match(experience, /!video.origin \|\| loadVideo \? <IntroductionVideo key=\{`\$\{locale\}-\$\{video.url\}`\}/);
  assert.match(video, /if \(local\) void startIntroductionPlayback/);
  assert.match(video, /active = false; media.pause\(\); media.removeAttribute\("src"\); media.load\(\)/);
  assert.match(video, /if \(!media.getAttribute\("src"\)\) media.src = video.url/);
  assert.match(video, /motion.matches \? 0 : 700/);
  assert.match(video, /return \(\) => clearTimeout\(timer\)/);
  assert.match(video, /event.origin !== video.origin \|\| event.source !== frame.current\?\.contentWindow/);
  assert.match(video, /attachVideoAmbience\(player.current, canvas.current\)/);
  assert.match(video, /canvas ref=\{canvas\} width=\{64\} height=\{36\}/);
  assert.match(experience, /onEnded=\{\(\) => go\("demo"\)\}/);
});

test("all four arrow keys traverse the experience without wrapping at either end", () => {
  for (const [index, step] of experienceSteps.entries()) {
    for (const key of ["ArrowRight", "ArrowDown"]) assert.equal(adjacentExperienceStep(step, key), experienceSteps[index + 1]);
    for (const key of ["ArrowLeft", "ArrowUp"]) assert.equal(adjacentExperienceStep(step, key), experienceSteps[index - 1]);
    assert.equal(adjacentExperienceStep(step, "Enter"), undefined);
  }
});

test("submission immediately replaces the imprint with a timestamp captured once", () => {
  assert.match(experience, /useState<MoodMoment \| null>\(null\)/);
  assert.match(experience, /if \(text\) setMoment\(\{ id: nextMoment.current\+\+, text, createdAt: Date.now\(\) \}\)/);
  assert.match(experience, /setMood\(""\)/);
  assert.doesNotMatch(experience, /MoodDrop|setMoments|chooseMoodExit|mood-cell-bud/);
  assert.match(stamp, /new Date\(moment.createdAt\)/);
  assert.doesNotMatch(stamp, /Date.now|setInterval|requestAnimationFrame|onPointer/);
});

test("the latest imprint survives steps and locale changes outside the video", () => {
  assert.match(experience, /moment && <MoodStamp moment=\{moment\} locale=\{locale\}/);
  assert.match(experience, /\(step === "mood" \|\| step === "video"\) && <section className="mood-composer/);
  const go = experience.slice(experience.indexOf("const go ="), experience.indexOf("function releaseMood"));
  assert.doesNotMatch(go, /setMoment|setMood\(/);
  assert.match(css, /\.experience-main:has\(\.mood-stamp-slot\) \{ padding-top: 112px;/);
  assert.match(css, /\.mood-stamp-slot \{ position: relative;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.mood-imprint \{ animation: none;/);
});

test("video submit stays centered inside the shorter field, with reserved text space", () => {
  assert.match(css, /\.experience-main\[data-step="video"\] \.mood-thought \{ top: 50%; right: 112px; bottom: auto; translate: 0 -50%; \}/);
  assert.match(css, /\.mood-cell:has\(\.mood-thought\) \.mood-input \{ padding-right: 172px;/);
  assert.match(css, /@media \(max-width: 639px\) \{\s*\.experience-main\[data-step="video"\] \.mood-thought \{ right: 88px; \}/);
  assert.match(css, /\.mood-cell:has\(\.mood-thought\) \.mood-input \{ padding-right: 148px;/);
  assert.doesNotMatch(css, /\.experience-main\[data-step="video"\] \.mood-thought \{[^}]*bottom: \d/);
});

test("step navigation preserves editing, native media keys and tabs", () => {
  assert.match(experience, /event.defaultPrevented \|\| event.repeat \|\| event.isComposing/);
  assert.match(experience, /input, textarea, select, button, a, video, audio, iframe/);
  assert.match(experience, /\[role="tablist"\], \[role="slider"\]/);
});

test("step navigation lives in the footer with an active step and no lateral controls", () => {
  assert.match(provider, /pathname === "\/experience" && <>\s*<div ref=\{setVoiceNoticeTarget\}/);
  assert.match(provider, /ref=\{setExperienceNavigationTarget\} className="flex justify-end sm:col-start-2 xl:col-start-3"/);
  assert.ok(provider.indexOf("<footer") < provider.indexOf("ref={setExperienceNavigationTarget}"));
  assert.ok(provider.indexOf('aria-label={t("Informations et préférences"') < provider.indexOf("ref={setExperienceNavigationTarget}"));
  assert.match(provider, /pathname === "\/experience" \? "max-w-none sm:grid sm:grid-cols-2 sm:items-center sm:gap-x-4 xl:grid-cols-\[1fr_auto_1fr\]" : "max-w-sm"/);
  assert.ok(provider.indexOf("ref={setVoiceNoticeTarget}") < provider.indexOf("ref={setExperienceNavigationTarget}"));
  assert.match(provider, /data-voice-notice-slot[^>]+empty:hidden/);
  assert.match(experience, /experienceNavigationTarget && createPortal\(/);
  assert.match(experience, /experienceSteps.map\(target => <button/);
  assert.match(experience, /aria-current=\{step === target \? "step" : undefined\}/);
  assert.match(experience, /step === "mood" && target === "video"\) moodInput.current\?\.form\?\.requestSubmit\(\)/);
  assert.doesNotMatch(experience, /fixed top-1\/2|Étape suivante|Étape précédente|onContinue=/);
});

test("consent appears only at home and settings links return there with focus", () => {
  assert.match(provider, /isEntrance && settings && <section ref=\{settingsRef\}/);
  assert.match(provider, /if \(!isEntrance\) \{ focusSettings.current = true; router.push\("\/"\); \}/);
  assert.match(provider, /if \(isEntrance && settings && focusSettings.current\)/);
  assert.match(provider, /settingsRef.current\?\.focus\(\)/);
});

test("demo starts at the companion scene and only mounts the chosen, enabled activity", () => {
  assert.match(demo, /useState<Activity \| null>\(null\)/);
  const hub = demo.slice(demo.indexOf('activity === null ?'), demo.indexOf('className="demo-toolbar'));
  assert.match(hub, /src="\/images\/noir.webp"/);
  assert.match(hub, /activities.map/);
  assert.match(hub, /onClick=\{\(\) => openActivity\(item\)\}/);
  assert.doesNotMatch(hub, /<ActivityPanel|<DemoChat|<Breathing|<Relaxation/);
  assert.match(demo, /<DemoChat locale=\{locale\} onContinue=\{onChatContinue\} \/>/);
  assert.match(experience, /onChatContinue=\{\(\) => go\("waitlist"\)\}/);
  assert.doesNotMatch(demo, /function Conversation|MediaRecorder|transcribeDemoAudio/);
  assert.match(experience, /<DemoActivities locale=\{locale\} enabled=\{config\.demo_enabled\} realtimeEnabled=\{config\.realtime_enabled\}/);
  assert.match(hub, /const unavailable = item === "voice" \? !realtimeEnabled : item === "chat" && !enabled;/);
  assert.match(demo, /\(\(activity === "voice" && !realtimeEnabled\) \|\| \(activity === "chat" && !enabled\)\) \?/);
  assert.match(demo, /activity === "breathing" \? <Breathing locale=\{locale\} \/> : activity === "relaxation" \? <Relaxation locale=\{locale\} \/>/);
  assert.match(breathing, /data-breathing-ui/);
  const relaxation = readFileSync(new URL("../components/relaxation.tsx", import.meta.url), "utf8");
  assert.match(relaxation, /sans micro ni envoi/);
  assert.doesNotMatch(demo, /AI demo|Démo avec une IA|t\.live/);
  assert.match(demo, /<ActivityPanel key=\{`\$\{activity\}-\$\{locale\}-\$\{generation\}`\}/);
  assert.match(demo, /returnTo.current = activity; setActivity\(null\)/);
});

test("demo illustrations resolve to five local WebP exports and breathing keeps both poses ready", () => {
  const filenames = [...(demo + breathing).matchAll(/"\/media\/demo\/([^"\s]+\.webp)"/g)].map(match => match[1]);
  assert.equal(new Set(filenames).size, 5);
  for (const filename of filenames) {
    const bytes = readFileSync(new URL(`../public/media/demo/${filename}`, import.meta.url));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  }
  assert.match(demo, /src=\{activityImages\[item\]\} alt=""/);
  assert.equal((breathing.match(/loading="eager"/g) ?? []).length, 2);
  assert.equal((breathing.match(/motion-reduce:transition-none/g) ?? []).length, 3);
  assert.match(breathing, /inhale \? "opacity-100" : "opacity-0"/);
  assert.match(breathing, /inhale \? "opacity-0" : "opacity-100"/);
});

test("demo restores scene focus and confines long content beneath its toolbar", () => {
  assert.match(demo, /panel.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(demo, /choices.current\[activities.indexOf\(returnTo.current\)\]\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(demo, /role="tabpanel"[^>]+tabIndex=\{0\}/);
  assert.match(css, /\.demo-panel \{ flex: 1; overflow-y: auto;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.demo-hub, \.demo-local-layout[^}]+animation: none;/);
});

test("desktop-only viewport shell retains accessible internal panel overflow", () => {
  assert.match(css, /\.experience-shell \{ display: contents; \}/);
  const desktop = css.slice(css.indexOf("@media (min-width: 1024px)"));
  assert.match(desktop, /html:has\(\.experience-shell\)[^}]+overflow: hidden/);
  assert.match(desktop, /\.experience-shell \{[^}]+height: 100dvh/);
  assert.match(desktop, /\.experience-panel \{[^}]+overflow-y: auto/);
  assert.match(css, /\.experience-main\[data-step="video"\] \.mood-composer \{ top: calc\(100% - 16px\)/);
});
