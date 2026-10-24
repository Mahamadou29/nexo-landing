import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { POLICY_VERSION } from "../lib/landing-api.ts";
import { mountSignup, flush } from "./signup-harness.mjs";

function fixture(t, locale = "fr", ready = true) {
  const ui = mountSignup(locale, ready);
  t.after(() => ui.dispose());
  return ui;
}
function fill(ui) { ui.type("email", "  signup@example.invalid  "); ui.type("note", "  Bonjour  "); ui.type("consent", true); }
const response = (status = 201, body = { status: "registered" }) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
async function settle(ui) { await flush(); ui.render(); }

test("one form, two semantic groups/cards; consent is separate and never preselected", t => {
  const ui = fixture(t);
  assert.equal(ui.all(node => node.type === "form").length, 1);
  assert.deepEqual(ui.all(node => node.props["data-signup-card"]).map(node => node.props["data-signup-card"]), ["contact", "confirm"]);
  assert.equal(ui.all(node => node.type === "fieldset").length, 2);
  assert.equal(ui.values.consent, false);
  assert.equal(ui.find(node => node.props["data-signup-success"] !== undefined), undefined);
  assert.equal(ui.find(node => node.props.className === "signup-cells").props["data-confirmed"], false);
  assert.equal(ui.find(node => node.props.className === "signup-cells").props["aria-hidden"], "true");
  assert.equal(ui.find(node => node.type === "p" && node.props.role === "status").props["aria-atomic"], "true");
});

test("prehydration disables both fieldsets and submit", t => {
  const ui = fixture(t, "en", false);
  assert.ok(ui.all(node => node.type === "fieldset" || node.type === "Button").every(node => node.props.disabled));
  assert.match(ui.text(), /JavaScript is required/);
});

test("invalid contact/consent never call the API and focus the visible invalid field", async t => {
  const ui = fixture(t);
  ui.submit(); await settle(ui);
  assert.equal(ui.focus, "email");
  ui.switchKind("phone"); ui.submit(); await settle(ui);
  assert.equal(ui.focus, "phone");
  ui.type("phone", "+221771234567"); ui.submit(); await settle(ui);
  assert.equal(ui.focus, "consent");
  ui.type("consent", true); ui.type("note", "x".repeat(1001)); ui.submit(); await settle(ui);
  assert.equal(ui.focus, "note");
  assert.equal(ui.calls.length, 0);
});

test("switching contact clears the inactive value and preserves note/consent", t => {
  const ui = fixture(t);
  fill(ui); ui.switchKind("phone");
  assert.equal(ui.values.email, ""); assert.equal(ui.values.note, "  Bonjour  "); assert.equal(ui.values.consent, true);
  ui.type("phone", "+221771234567"); ui.switchKind("email");
  assert.equal(ui.values.phone, "");
  assert.equal(ui.find(node => node.type === "Input").props.type, "email");
});

test("pending locks both cards, deduplicates and waits for the complete registered body", async t => {
  const ui = fixture(t); fill(ui);
  ui.submit(); ui.submit(); await settle(ui);
  assert.equal(ui.calls.length, 1); assert.equal(ui.state, "sending");
  assert.ok(ui.all(node => node.type === "fieldset" || node.type === "Button").every(node => node.props.disabled));
  assert.equal(ui.find(node => node.type === "form").props["aria-busy"], true);
  assert.match(ui.text(), /En attente de sa confirmation/);
  assert.equal(ui.find(node => node.props.className === "signup-cells").props["data-confirmed"], false);
  const { url, options } = ui.calls[0];
  assert.ok(String(url).endsWith("/api/v1/landing/waitlist"));
  assert.deepEqual(JSON.parse(options.body), { email: "signup@example.invalid", note: "Bonjour", locale: "fr", consent: true, policy_version: POLICY_VERSION });
  assert.equal(options.method, "POST"); assert.equal(options.credentials, "omit");
  assert.equal(options.cache, "no-store"); assert.equal(options.referrerPolicy, "no-referrer");
  let resolveBody;
  ui.calls[0].resolve({ status: 201, json: () => new Promise(resolve => { resolveBody = resolve; }) });
  await settle(ui); assert.equal(ui.state, "sending"); assert.equal(ui.resetCount, 0);
  resolveBody({ status: "registered" }); await settle(ui);
  assert.equal(ui.state, "registered"); assert.equal(ui.resetCount, 1); assert.equal(ui.headingFocusCount, 1);
  assert.equal(ui.find(node => node.props.className === "signup-cells").props["data-confirmed"], true);
  assert.ok(ui.find(node => node.props["data-signup-success"] !== undefined));
  assert.equal(ui.all(node => node.type === "Button" && node.props.type === "submit").length, 0);
  assert.equal(ui.values.email, ""); assert.equal(ui.values.note, ""); assert.equal(ui.values.consent, false);
  assert.match(ui.text(), /Tu fais partie de l’aventure/);
  ui.render("en"); assert.equal(ui.headingFocusCount, 1); assert.match(ui.text(), /You are part of the journey/);
  assert.doesNotMatch(ui.text(), /signup@example/);
});

test("phone-only signup omits blank note/email and uses current locale", async t => {
  const ui = fixture(t, "en"); ui.switchKind("phone"); ui.type("phone", "+221771234567"); ui.type("consent", true);
  ui.submit(); await settle(ui);
  assert.deepEqual(JSON.parse(ui.calls[0].options.body), { phone: "+221771234567", locale: "en", consent: true, policy_version: POLICY_VERSION });
  ui.calls[0].resolve(response()); await settle(ui);
  assert.match(ui.text(), /contact you on your phone/);
});

for (const [name, status, body] of [["HTTP 200", 200, { status: "registered" }], ["server error", 503, { status: "registered" }], ["rate limit", 429, {}], ["wrong body", 201, { status: "pending" }], ["missing status", 201, {}], ["null body", 201, null]]) {
  test(`${name} cannot confirm; values remain available for explicit retry`, async t => {
    const ui = fixture(t, "en"); fill(ui); ui.submit(); await settle(ui);
    ui.calls[0].resolve(response(status, body)); await settle(ui);
    assert.equal(ui.state, "error"); assert.equal(ui.resetCount, 0);
    assert.equal(ui.values.email, "  signup@example.invalid  "); assert.equal(ui.values.consent, true);
    assert.equal(ui.find(node => node.props.className === "signup-cells").props["data-confirmed"], false);
    assert.ok(ui.all(node => node.type === "fieldset").every(node => !node.props.disabled));
    assert.match(ui.text(), status === 429 ? /Too many requests/ : /Nothing is confirmed/);
    assert.match(ui.text(), /Try signing up again/);
    ui.submit(); await settle(ui); assert.equal(ui.calls.length, 2); assert.equal(ui.state, "sending");
    ui.calls[1].resolve(response()); await settle(ui); assert.equal(ui.state, "registered");
  });
}

for (const failure of [new TypeError("offline"), new DOMException("Timed out", "TimeoutError")]) {
  test(`${failure.name} shows translated failure without auto retry or success`, async t => {
    const ui = fixture(t); fill(ui); ui.submit(); await settle(ui);
    ui.calls[0].reject(failure); await settle(ui);
    assert.equal(ui.state, "error"); assert.equal(ui.calls.length, 1); assert.match(ui.text(), /Rien n’est confirmé/);
    assert.equal(ui.resetCount, 0);
  });
}

test("malformed JSON is not registration", async t => {
  const ui = fixture(t); fill(ui); ui.submit(); await settle(ui);
  ui.calls[0].resolve(new Response("not json", { status: 201 })); await settle(ui);
  assert.equal(ui.state, "error"); assert.equal(ui.resetCount, 0);
});

test("unmount aborts the request and ignores a late successful response", async t => {
  const ui = fixture(t); fill(ui); ui.submit(); await settle(ui);
  ui.unmount(); assert.equal(ui.calls[0].options.signal.aborted, true);
  ui.calls[0].resolve(response()); await settle(ui);
  assert.equal(ui.state, "sending"); assert.equal(ui.resetCount, 0); assert.equal(ui.headingFocusCount, 0);
});

test("unmount during response decoding cannot celebrate", async t => {
  const ui = fixture(t); fill(ui); ui.submit(); await settle(ui);
  let resolveBody;
  ui.calls[0].resolve({ status: 201, json: () => new Promise(resolve => { resolveBody = resolve; }) }); await settle(ui);
  ui.unmount(); resolveBody({ status: "registered" }); await settle(ui);
  assert.equal(ui.resetCount, 0); assert.notEqual(ui.state, "registered");
});

test("unmount while async validation runs prevents starting a request", async t => {
  const ui = fixture(t); fill(ui); ui.submit(); ui.unmount(); await flush();
  assert.equal(ui.calls.length, 0);
});

test("signup CSS is scoped, responsive and motion is finite and opt-in", () => {
  const css = readFileSync(new URL("../components/signup.css", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/signup-form.tsx", import.meta.url), "utf8");
  const experience = readFileSync(new URL("../components/experience.tsx", import.meta.url), "utf8");
  const discovery = readFileSync(new URL("../components/discovery.tsx", import.meta.url), "utf8");
  assert.match(css, /@container \(min-width: 42rem\)/);
  assert.match(css, /\.signup-grid \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.signup-card \{[^}]*min-width: 0/);
  assert.doesNotMatch(css.match(/\.signup-card \{[^}]*\}/g).join(""), /overflow|height:/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.ok(css.indexOf("animation:") > css.indexOf("prefers-reduced-motion: no-preference"));
  assert.doesNotMatch(css, /infinite|#[\da-f]{3,8}\b|\.mood|\.experience|\.breathing/);
  assert.doesNotMatch(component, /setTimeout|setInterval|requestAnimationFrame|localStorage|sessionStorage/);
  assert.match(component, /h-auto min-h-13 w-full min-w-0[^\n]*whitespace-normal/);
  assert.match(experience, /step === "waitlist" && <section className="experience-panel mx-auto w-full py-8"/);
  assert.match(discovery, /<div className=\{sectionClass\}><SignupForm locale=\{locale\} \/><\/div>/);
  assert.doesNotMatch(discovery, /id="signup-title"/);
});
