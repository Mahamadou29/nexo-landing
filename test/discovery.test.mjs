import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createElement } from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const link = ({ children, ...props }) => createElement("a", props, children);
function load(file, imports) {
  const code = ts.transpileModule(read(file), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (name === "react/jsx-runtime") return jsx;
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected discovery dependency: ${name}`);
  } });
  return exports;
}
const { Icon } = load("../components/icon.tsx", {});
const { DiscoveryRoadmap } = load("../components/discovery-roadmap.tsx", {
  "next/link": { default: link }, "@/components/icon": { Icon },
});
const { Discovery } = load("../components/discovery.tsx", {
  "next/link": { default: link },
  "next/image": { default: ({ src, alt }) => createElement("img", { src, alt }) },
  "@/components/icon": { Icon },
  "@/components/product-preview": { ProductPreview: ({ locale }) => createElement("div", { "data-preview-locale": locale }) },
  "@/components/signup-form": { SignupForm: ({ locale }) => createElement("div", { "data-signup-locale": locale }) },
  "@/components/discovery-roadmap": { DiscoveryRoadmap },
  "./discovery.css": {},
});
const render = (component, locale) => renderToStaticMarkup(createElement(component, { locale }));
const { DiscoveryNavigation } = load("../components/discovery-navigation.tsx", {
  "next/link": { default: link },
  "lucide-react": { Menu: () => createElement("svg", { "aria-hidden": true }) },
  "./discovery-navigation.css": {},
});

test("discovery has one shared header instead of two stacked navigation bars", () => {
  const provider = read("../components/landing-provider.tsx");
  assert.match(provider, /isDiscovery && <DiscoveryNavigation locale=\{locale\}/);
  assert.match(provider, /!isMinimalPage && !isDiscovery && <nav/);
  assert.doesNotMatch(render(Discovery, "fr"), /<header/);
  for (const locale of ["fr", "en"]) {
    const html = render(DiscoveryNavigation, locale);
    assert.doesNotMatch(html, /Découvrir|Ressentir|>Discover<|>Experience</);
    for (const href of ["#possibilites", "#parcours", "#faq", "/experience", "#inscription"]) assert.ok(html.includes(`href="${href}"`));
    assert.match(html, /<details[^>]+data-discovery-menu/);
    assert.match(html, /<summary aria-label=/);
    assert.ok(html.includes(locale === "fr" ? "Essayer Nexo" : "Try Nexo"));
  }
});

for (const locale of ["fr", "en"]) {
  test(`${locale}: semantic roadmap shows demo, app, reminders, classic then connected plush`, () => {
    const html = render(DiscoveryRoadmap, locale);
    assert.match(html, /<section[^>]+id="parcours"[^>]+aria-labelledby="roadmap-title"[^>]+aria-describedby="roadmap-note"/);
    assert.match(html, /<ol[^>]+role="list"/);
    assert.deepEqual([...html.matchAll(/data-roadmap-step="([^"]+)"/g)].map(match => match[1]), ["demo", "app", "reminders", "classic-plush", "connected-plush"]);
    assert.equal([...html.matchAll(/data-roadmap-status=/g)].length, 5);
    assert.equal([...html.matchAll(/<h3/g)].length, 5);
    assert.doesNotMatch(html, /<button|<input|<progress|aria-valuenow|\b20\d{2}\b|\d+%/);
    assert.match(html, locale === "fr" ? /Une vision qui peut évoluer, pas un calendrier/ : /An evolving vision, not a launch schedule/);
    assert.match(html, locale === "fr" ? /Aucune date annoncée/ : /No dates have been announced/);
    assert.match(html, locale === "fr" ? /n’est pas l’application complète/ : /not the full app/);
    assert.match(html, locale === "fr" ? /ne donne pas encore accès/ : /does not yet give access/);
    assert.match(html, locale === "fr" ? /pas un produit disponible ni une précommande/ : /not an available product or a preorder/);
  });

  test(`${locale}: reminder vision includes scheduling and optional invitations, not shipped monitoring`, () => {
    const html = render(DiscoveryRoadmap, locale).split('data-roadmap-step="reminders"')[1].split("</li>")[0];
    for (const phrase of locale === "fr" ? [
      "Prévu", "rappels que tu programmes", "si tu le souhaites", "invitations de Nexo", "horaires et les types", "Uniquement avec ton accord", "modifier", "pause", "désactiver", "pas une surveillance", "pas encore disponible",
    ] : [
      "Planned", "Reminders you schedule", "if you wish", "invitations from Nexo", "times and types", "Only with your permission", "change", "pause", "disable", "not monitoring", "not available yet",
    ]) assert.ok(html.includes(phrase), `Missing reminder qualification: ${phrase}`);
  });

  test(`${locale}: existing Instagram account is a localized plain link without embeds or preloads`, () => {
    const html = render(DiscoveryRoadmap, locale);
    const links = [...html.matchAll(/<a\b[^>]*href="https:\/\/www\.instagram\.com\/nexo\.companion"[^>]*>[^<]*<\/a>/g)];
    assert.equal(links.length, 1);
    assert.match(links[0][0], />@nexo\.companion<\/a>/);
    assert.match(links[0][0], /rel="noreferrer"/);
    assert.doesNotMatch(links[0][0], /target=|ping=/);
    assert.ok(links[0][0].includes(locale === "fr" ? 'aria-label="Nexo sur Instagram : @nexo.companion"' : 'aria-label="Nexo on Instagram: @nexo.companion"'));
    assert.ok(html.includes(locale === "fr" ? "Suivre l’aventure sur Instagram" : "Follow the journey on Instagram"));
    assert.doesNotMatch(html, /<iframe|<script|<link|instagram-media|data-instgrm/);
  });

  test(`${locale}: discovery retains destinations and leaf interactions without embedding the demo`, () => {
    const html = render(Discovery, locale);
    assert.match(html, new RegExp(`lang="${locale}"`));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const id of ["contenu", "accueil", "possibilites", "parcours", "roadmap", "confidentialite", "faq", "inscription"]) assert.ok(ids.includes(id));
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `Broken anchor: ${id}`);
    for (const path of ["/experience", "/confidentialite", "/conditions", "/"]) assert.ok(html.includes(`href="${path}"`));
    assert.match(html, new RegExp(`data-preview-locale="${locale}"`));
    assert.equal([...html.matchAll(/data-signup-locale=/g)].length, 1);
    assert.match(html, new RegExp(`data-signup-locale="${locale}"`));
    assert.equal([...html.matchAll(/<details/g)].length, 6);
    assert.equal([...html.matchAll(/<h1/g)].length, 1);
    assert.doesNotMatch(html, /signup-title|<iframe|<audio|<video|<canvas/);
    const hero = html.split('id="accueil"')[1].split("</section>")[0];
    assert.match(hero, locale === "fr" ? /href="\/experience"[^>]*>Essayer Nexo/ : /href="\/experience"[^>]*>Try Nexo/);
    assert.match(hero, /href="#inscription"/);
  });
}

test("roadmap styles remain discovery-scoped, intrinsically vertical and motion-free", () => {
  const css = read("../components/discovery.css");
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\{)/g);
  for (const selector of selectors) assert.ok(selector.trim().startsWith(".discovery-page") || selector.trim().startsWith("@media"), selector);
  assert.match(css, /grid-template-columns: 2\.75rem minmax\(0, 1fr\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /@keyframes|100vw|overflow[^;]*hidden|#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(read("../components/discovery-roadmap.tsx"), /useEffect|useState|fetch\(|localStorage|setTimeout|style=/);
});
