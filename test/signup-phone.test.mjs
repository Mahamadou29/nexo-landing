import assert from "node:assert/strict";
import test from "node:test";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import { DEFAULT_PHONE_COUNTRY, getPhoneCountries, makeSignupSchema } from "../lib/signup-schema.ts";
import { mountSignup, flush } from "./signup-harness.mjs";

const contact = phone => ({ email: "", phone, note: "", consent: true });
const parse = (phone, country = "SN") => makeSignupSchema("en", country).parse(contact(phone)).phone;
const select = ui => ui.find(node => node.type === "select");
const dialCode = ui => ui.find(node => node.props["data-signup-dial-code"] !== undefined).props.children;
function fixture(t, locale = "fr") {
  const ui = mountSignup(locale);
  t.after(() => ui.dispose());
  ui.switchKind("phone");
  return ui;
}
async function settle(ui) { await flush(); ui.render(); }

for (const locale of ["fr", "en"]) {
  test(`${locale}: metadata covers every supported country with localized sorted names and calling codes`, () => {
    assert.equal(DEFAULT_PHONE_COUNTRY, "SN");
    const options = getPhoneCountries(locale);
    assert.deepEqual(options.map(option => option.country).sort(), getCountries().sort());
    const collator = new Intl.Collator(locale);
    for (const [index, option] of options.entries()) {
      assert.equal(option.dialCode, `+${getCountryCallingCode(option.country)}`);
      if (index) assert.ok(collator.compare(options[index - 1].name, option.name) <= 0);
    }
    assert.equal(options.find(option => option.country === "SN").name, locale === "fr" ? "Sénégal" : "Senegal");
  });

  test(`${locale}: selector precedes empty national field and defaults to Senegal +221`, async t => {
    const ui = fixture(t, locale);
    assert.equal(select(ui).props.value, "SN");
    assert.equal(dialCode(ui), "+221");
    assert.match(ui.text(), locale === "fr" ? /Sénégal/ : /Senegal/);
    const label = ui.find(node => node.type === "label");
    assert.equal(label.props.htmlFor, select(ui).props.id);
    const controls = ui.all(node => node.type === "select" || (node.type === "Input" && node.props.name === "phone"));
    assert.equal(controls[0].type, "select");
    assert.equal(controls[1].props.autoComplete, "tel-national");
    assert.equal(ui.values.phone, "");
    ui.type("consent", true); ui.submit(); await settle(ui);
    assert.equal(ui.calls.length, 0); assert.equal(ui.focus, "phone");
  });
}

for (const phone of ["77 123 45 67", "771234567", "+221771234567", "+221 77 123 45 67", "+221 (77) 123-45-67"]) {
  test(`Senegal normalization adds +221 exactly once: ${phone}`, () => assert.equal(parse(phone), "+221771234567"));
}
for (const [country, phone, expected] of [
  ["FR", "06 12 34 56 78", "+33612345678"],
  ["FR", "+33 6 12 34 56 78", "+33612345678"],
  ["US", "(202) 555-0123", "+12025550123"],
  ["CA", "+1 416 555 0123", "+14165550123"],
  ["GB", "07400 123456", "+447400123456"],
  ["IT", "02 3661 8300", "+390236618300"],
  ["IN", "09876543210", "+919876543210"],
  ["AU", "0412 345 678", "+61412345678"],
]) test(`${country} handles national prefixes or full pasted numbers`, () => assert.equal(parse(phone, country), expected));

for (const phone of ["", "   ", "+221", "221", "123", "77123456", "7712345678", "111111111", "+221221771234567", "Call +221771234567", "+221771234567 ext 1", "++221771234567", "77/123/45/67", "x".repeat(65)]) {
  test(`rejects invalid/empty phone without treating country as contact: ${phone}`, () => {
    const result = makeSignupSchema("en").safeParse(contact(phone));
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(issue => issue.path[0] === "phone"));
  });
}

test("pasted mismatches are actionable, including countries sharing +1", () => {
  for (const [selected, number, destination] of [["SN", "+33612345678", "France"], ["US", "+14165550123", "Canada"]]) {
    const result = makeSignupSchema("en", selected).safeParse(contact(number));
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, new RegExp(destination));
    assert.match(result.error.issues[0].message, /Select that country or correct/);
  }
});

test("country switching keeps raw input, never submits, fixes mismatch and omits country from payload", async t => {
  const ui = fixture(t);
  ui.type("phone", "+33 6 12 34 56 78"); ui.type("consent", true);
  ui.submit(); await settle(ui);
  assert.equal(ui.calls.length, 0); assert.equal(ui.focus, "phone");
  assert.match(ui.form.errors.phone.message, /France \(\+33\)/);
  ui.switchCountry("FR");
  assert.equal(ui.calls.length, 0); assert.equal(ui.values.phone, "+33 6 12 34 56 78");
  assert.equal(dialCode(ui), "+33");
  ui.type("phone", "06 12 34 56 78");
  ui.submit(); ui.submit(); await settle(ui);
  assert.equal(ui.calls.length, 1); assert.equal(select(ui).props.disabled, true);
  const payload = JSON.parse(ui.calls[0].options.body);
  assert.equal(payload.phone, "+33612345678");
  assert.equal("country" in payload, false); assert.equal("phoneCountry" in payload, false); assert.equal("email" in payload, false);
});

test("locale changes preserve selected country/raw number, clear translated errors, and use new locale", async t => {
  const ui = fixture(t);
  ui.switchCountry("US"); ui.type("phone", "(202) 555-0123"); ui.type("note", "Note"); ui.type("consent", true);
  ui.render("en");
  assert.equal(select(ui).props.value, "US"); assert.equal(dialCode(ui), "+1");
  assert.equal(ui.values.phone, "(202) 555-0123"); assert.equal(ui.values.note, "Note"); assert.equal(ui.values.consent, true);
  assert.match(ui.text(), /United States/);
  ui.submit(); await settle(ui);
  assert.equal(JSON.parse(ui.calls[0].options.body).locale, "en");
});

test("clearing input rejects country alone; switching channel clears phone but preserves country and email path", async t => {
  const ui = fixture(t);
  ui.switchCountry("FR"); ui.type("phone", "0612345678"); ui.type("phone", ""); ui.type("consent", true);
  ui.submit(); await settle(ui); assert.equal(ui.calls.length, 0); assert.equal(ui.focus, "phone");
  ui.type("phone", "0612345678"); ui.switchKind("email"); assert.equal(ui.values.phone, "");
  ui.switchKind("phone"); assert.equal(select(ui).props.value, "FR"); assert.equal(ui.values.phone, "");
  ui.switchKind("email"); ui.type("email", "signup@example.invalid"); ui.submit(); await settle(ui);
  const payload = JSON.parse(ui.calls[0].options.body);
  assert.equal(payload.email, "signup@example.invalid"); assert.equal("phone" in payload, false); assert.equal("country" in payload, false);
});

test("phone errors permit explicit retry without losing country/input; success clears and resets", async t => {
  const ui = fixture(t, "en"); ui.switchCountry("FR"); ui.type("phone", "0612345678"); ui.type("consent", true);
  ui.submit(); await settle(ui);
  ui.calls[0].reject(new TypeError("offline")); await settle(ui);
  assert.equal(ui.state, "error"); assert.equal(select(ui).props.value, "FR"); assert.equal(ui.values.phone, "0612345678");
  ui.submit(); await settle(ui);
  assert.equal(ui.calls.length, 2);
  ui.calls[1].resolve(new Response(JSON.stringify({ status: "registered" }), { status: 201 })); await settle(ui);
  assert.equal(ui.state, "registered"); assert.equal(ui.values.phone, ""); assert.equal(ui.values.consent, false);
  assert.match(ui.text(), /You are part of the journey\./);
  assert.equal(ui.resetCount, 1);
  ui.dispose();
  const fresh = fixture(t, "en");
  assert.equal(select(fresh).props.value, "SN");
  assert.equal(fresh.values.phone, "");
});

test("default national input is submitted once as E.164 and clears on success", async t => {
  const ui = fixture(t);
  ui.type("phone", "77 123 45 67"); ui.type("consent", true);
  ui.submit(); await settle(ui);
  assert.equal(JSON.parse(ui.calls[0].options.body).phone, "+221771234567");
  ui.calls[0].resolve(new Response(JSON.stringify({ status: "registered" }), { status: 201 })); await settle(ui);
  assert.equal(ui.values.phone, "");
  assert.match(ui.text(), /Tu fais partie de l’aventure\./);
});

test("changing language clears old phone errors and revalidates in the current language", async t => {
  const ui = fixture(t);
  ui.type("phone", "+33612345678"); ui.type("consent", true); ui.submit(); await settle(ui);
  assert.match(ui.form.errors.phone.message, /Choisis ce pays/);
  ui.render("en"); assert.deepEqual(ui.form.errors, {});
  assert.equal(select(ui).props.value, "SN"); assert.equal(ui.values.phone, "+33612345678");
  ui.submit(); await settle(ui);
  assert.match(ui.form.errors.phone.message, /Select that country/);
  assert.equal(ui.calls.length, 0); assert.equal(ui.focus, "phone");
});
