import assert from "node:assert/strict";
import test from "node:test";
import { DemoApiError } from "../lib/demo-api.ts";
import { flush, ui, mountUi } from "./demo-chat-harness.mjs";

const count = h => h.find(node => node.props?.["data-chat-remaining"] === true).props.children[0];

test("initial quota loading shows unknown, disables sending and never optimistically grants 15", async () => {
  let resolve;
  const h = mountUi("en", undefined, { getQuota: () => new Promise(done => { resolve = done; }) });
  h.type("Hello");
  assert.equal(count(h), "—");
  assert.equal(h.button("Agree and send").props.disabled, true);
  h.submit(); await flush();
  assert.equal(h.calls.length, 0);
  resolve(0); await flush(); h.render();
  assert.equal(count(h), 0);
  assert.equal(h.button("Agree and send").props.disabled, true);
  h.unmount();
});

for (const locale of ["fr", "en"]) {
  test(`${locale}: blocked storage and failed quota are readable, disabled and retryable`, async () => {
    const h = await ui(locale, undefined, { storageError: Error("denied") });
    h.type("Hello");
    assert.equal(count(h), "—");
    assert.equal(h.calls.length, 0);
    assert.equal(h.quotaCalls.length, 0);
    assert.match(h.find(node => node.props?.role === "status").props.children, locale === "fr" ? /stockage/ : /storage/);
    const failed = await ui(locale, undefined, { quotaError: new DemoApiError("network") });
    failed.type("Hello");
    assert.equal(count(failed), "—");
    assert.match(failed.find(node => node.props?.role === "status").props.children, locale === "fr" ? /vérifié/ : /checked/);
    const retryLabel = locale === "fr" ? "Réessayer" : "Try again";
    failed.backend.quotaError = null;
    failed.backend.remaining = 6;
    failed.find(node => node.type === "Button" && node.props.children === retryLabel).props.onClick();
    await flush(); failed.render();
    assert.equal(count(failed), 6);
    assert.equal(failed.find(node => node.type === "Button" && node.props.children === retryLabel), undefined, "retry disappears after recovery");
    h.unmount(); failed.unmount();
  });
}

test("a healthy chat has no allowance-check or retry button in either language", async () => {
  for (const locale of ["fr", "en"]) {
    const h = await ui(locale);
    assert.equal(h.find(node => node.type === "Button" && ["Vérifier le solde", "Check allowance", "Réessayer", "Try again"].includes(node.props.children)), undefined);
    assert.equal(count(h), 15);
    h.unmount();
  }
});

test("accepted submission clears the composer and shows organic cells before an unframed, stable-width reply", async () => {
  const h = await ui("en");
  h.type("Hi"); h.submit(); await flush(); h.render();
  assert.equal(h.formState.content, "");
  const typing = h.find(node => node.props?.["data-chat-typing"] === true);
  assert.equal(typing.props["aria-hidden"], "true");
  const dots = typing.props.children;
  assert.equal(dots.length, 3);
  for (const dot of dots) {
    assert.equal(dot.type, "svg");
    assert.match(dot.props.className, /nexo-chat-cell/);
    assert.equal(dot.props.children.type, "path");
  }
  assert.equal(new Set(dots.map(dot => dot.props.children.props.d)).size, 3);
  const bubbles = h.all(node => node.type === "li");
  assert.equal(bubbles.length, 2);
  assert.match(bubbles[0].props.className, /w-fit.*rounded-2xl/);
  const replyClass = bubbles[1].props.className;
  assert.match(replyClass, /w-full/);
  assert.doesNotMatch(replyClass, /border|rounded|bg-|w-fit/);
  assert.ok(!JSON.stringify(bubbles).includes("Nexo is replying"));
  assert.match(h.find(node => node.props?.role === "status").props.className, /sr-only/);
  h.calls[0].onText("A progressively longer reply"); h.render();
  assert.equal(h.find(node => node.props?.["data-chat-typing"] === true), undefined);
  assert.equal(h.all(node => node.type === "li")[1].props.className, replyClass);
  h.calls[0].resolve("A progressively longer reply, now complete."); await flush(); h.render();
  assert.equal(h.all(node => node.type === "li")[1].props.className, replyClass);
  h.unmount();
});

for (const outcome of ["success", "failure", "cancel"]) {
  test(`a newer draft survives ${outcome}, even while the old response streams`, async () => {
    const h = await ui("en");
    h.type("Submitted"); h.submit(); await flush(); h.render();
    assert.equal(h.formState.content, "");
    h.type("Newer unsent draft");
    if (outcome === "success") h.calls[0].resolve("Complete");
    else if (outcome === "failure") h.calls[0].reject(new DemoApiError("response"));
    else h.button("Stop reply").props.onClick();
    await flush(); h.render();
    assert.equal(h.formState.content, "Newer unsent draft");
    h.unmount();
  });
}

test("failure/cancel restores the exact submitted draft only when the user has not edited", async () => {
  const h = await ui("en");
  h.type("  Exact draft\n "); h.submit(); await flush(); h.render();
  h.calls[0].reject(new DemoApiError("response")); await flush(); h.render();
  assert.equal(h.formState.content, "  Exact draft\n ");
  h.submit(); await flush(); h.render();
  assert.equal(h.formState.content, "");
  h.button("Stop reply").props.onClick();
  assert.equal(h.formState.content, "  Exact draft\n ");
  await flush(); h.render(); h.submit(); await flush(); h.render();
  h.type("Changed my mind"); h.type("");
  h.calls[2].reject(new DemoApiError("response")); await flush(); h.render();
  assert.equal(h.formState.content, "", "typing then deleting is still a newer draft");
  h.unmount();
});

test("visitor storage changes refresh quota while unrelated analytics storage changes do not", async () => {
  const h = await ui("en");
  const requests = h.quotaCalls.length;
  h.backend.remaining = 4;
  h.listeners.get("storage")({ key: "analytics" });
  await flush();
  assert.equal(h.quotaCalls.length, requests);
  h.listeners.get("storage")({ key: "nexo.chat.visitor.v1" });
  await flush(); h.render();
  assert.equal(count(h), 4);
  assert.equal(h.quotaCalls.length, requests + 1);
  h.backend.remaining = 0;
  h.listeners.get("storage")({ key: null });
  await flush(); h.render();
  assert.equal(count(h), 0);
  h.type("Cannot reset");
  assert.equal(h.button("Agree and send").props.disabled, true);
  h.unmount();
});

test("focus rechecks another tab's authoritative budget; clearing does not restore it", async () => {
  const h = await ui("en");
  h.backend.remaining = 0;
  h.listeners.get("focus")(); await flush(); h.render();
  assert.equal(count(h), 0);
  h.find(node => node.type === "Button" && node.props.children === "Clear conversation").props.onClick(); h.render();
  h.type("Hello");
  assert.equal(count(h), 0);
  assert.equal(h.button("Agree and send").props.disabled, true);
  h.submit(); await flush();
  assert.equal(h.calls.length, 0);
  h.unmount();
  const reload = await ui("fr", undefined, { remaining: 0 });
  assert.equal(count(reload), 0);
  reload.unmount();
});
