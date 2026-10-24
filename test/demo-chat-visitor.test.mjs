import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { visitor, VISITOR_ID } from "./demo-chat-harness.mjs";

function storage(values = []) {
  const items = new Map(values);
  return { items, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}

test("chat UUID persists across reload-like helper invocations, independently of analytics", () => {
  const local = storage([["analytics", "unrelated-opt-in-id"]]);
  let generated = 0;
  assert.equal(visitor.getChatVisitorId(local, () => { generated++; return VISITOR_ID; }), VISITOR_ID);
  for (let reload = 0; reload < 4; reload++) assert.equal(visitor.getChatVisitorId(local, () => { throw Error("must reuse"); }), VISITOR_ID);
  assert.equal(generated, 1);
  assert.equal(local.items.get("analytics"), "unrelated-opt-in-id");
  assert.deepEqual([...local.items.keys()], ["analytics", "nexo.chat.visitor.v1"]);
});

test("cleared storage/new browser inherently permits a newly generated identity, not fingerprint recovery", () => {
  const local = storage();
  visitor.getChatVisitorId(local, () => VISITOR_ID);
  local.items.clear();
  const next = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  assert.equal(visitor.getChatVisitorId(local, () => next), next);
});

test("terms and privacy distinguish persistent chat enforcement from optional analytics", () => {
  const policy = readFileSync(new URL("../components/policy.tsx", import.meta.url), "utf8");
  const sections = policy.split("\n").filter(line => line.includes("Un identifiant dédié au solde du chat") || line.includes("La conversation écrite"));
  assert.equal(sections.length, 2);
  for (const section of sections) {
    assert.match(section, /sans expiration ni suppression automatiques/);
    assert.match(section, /(?:no|without) automatic expiry or deletion/);
    assert.match(section, /ne supprime pas l’ancien compteur côté serveur/);
    assert.match(section, /does not (?:erase|delete) the previous server-side counter/);
    assert.match(section, /optional analytics/);
    assert.match(section, /normal or forced reload/);
    assert.match(section, /IP addresses/);
  }
});

test("storage denial, failed persistence, invalid UUID and unavailable crypto fail closed", () => {
  assert.throws(() => visitor.getChatVisitorId({ getItem() { throw Error("denied"); } }));
  assert.throws(() => visitor.getChatVisitorId({ getItem: () => null, setItem() { throw Error("denied"); } }, () => VISITOR_ID));
  assert.throws(() => visitor.getChatVisitorId({ getItem: () => null, setItem() {} }, () => VISITOR_ID));
  assert.throws(() => visitor.getChatVisitorId(storage([[visitor.CHAT_VISITOR_KEY, "invalid"]]), () => VISITOR_ID));
  assert.throws(() => visitor.getChatVisitorId(storage(), () => "invalid"));
  assert.throws(() => visitor.getChatVisitorId(storage(), () => { throw Error("no crypto"); }));
});
