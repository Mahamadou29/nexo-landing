import assert from "node:assert/strict";
import test from "node:test";
import { signupSchema, makeSignupSchema } from "../lib/signup-schema.ts";
const valid = { email: "demo@example.invalid", phone: "", note: "", consent: true };
for (const email of ["", "   ", "incorrect", "sans@", "a".repeat(250) + "@example.fr"]) {
  test("rejects invalid or empty email: " + email.slice(0, 20), () => assert.equal(signupSchema.safeParse({ ...valid, email }).success, false));
}
test("accepts and trims email and note", () => assert.deepEqual(signupSchema.parse({ ...valid, email: "  demo@example.invalid  ", note: " hello " }), { ...valid, note: "hello" }));
test("accepts matching international phone instead of email", () => assert.equal(makeSignupSchema("fr", "FR").safeParse({ ...valid, email: "", phone: "+33612345678" }).success, true));
test("rejects two contacts, no consent, malformed phone and long note", () => {
 for (const value of [{ phone: "+221771234567" }, { consent: false }, { email: "", phone: "123" }, { email: "", phone: "+1234567" }, { note: "x".repeat(1001) }]) assert.equal(signupSchema.safeParse({ ...valid, ...value }).success, false);
});
test("strips identifiers, mood and passwords", () => assert.deepEqual(signupSchema.parse({ ...valid, visitor_id: "not-allowed", mood: "private", password: "not-collected" }), valid));
test("English validation is translated", () => assert.match(makeSignupSchema("en").safeParse({ ...valid, consent: false }).error.issues[0].message, /Permission/));
