import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DemoApiError } from "../lib/demo-api.ts";
import { flush, ui } from "./demo-chat-harness.mjs";

for (const [locale, agree, send, stop, clear] of [
  ["fr", "Accepter et envoyer", "Envoyer", "Arrêter la réponse", "Effacer la conversation"],
  ["en", "Agree and send", "Send", "Stop reply", "Clear conversation"],
]) {
  test(`${locale}: consent, immediate user, stream, completion and clear use actual TSX handlers`, async () => {
    const h = await ui(locale);
    assert.equal(h.calls.length, 0);
    assert.ok(h.button(agree));
    assert.equal(h.button(agree).props.disabled, true);
    assert.equal(h.portals.at(-1).destination, h.target);
    assert.ok(h.find(node => node.type === "Link" && node.props.href === "/conditions#conversation-ecrite"));
    assert.equal(h.all(node => node.props?.type === "checkbox").length, 0);
    h.formState.content = "Bonjour";
    h.render(); h.submit(); h.submit();
    await flush(); h.render();
    assert.equal(h.calls.length, 1, "lock covers asynchronous validation");
    assert.ok(h.button(stop));
    assert.equal(h.find(node => node.type === "textarea").props.readOnly, undefined);
    assert.equal(h.formState.content, "");
    assert.ok(h.find(node => node.type === "li" && node.props.children.includes("Bonjour")));
    h.calls[0].onText("Une réponse"); h.render();
    const words = h.all(node => node.props?.className === "nexo-chat-word");
    assert.equal(words.map(node => node.props.children).join(""), "Une réponse");
    assert.equal(h.find(node => node.props?.["data-chat-messages"] === true).props["aria-live"], "off");
    assert.ok(!JSON.stringify(h.find(node => node.props?.role === "status")).includes("Une réponse"));
    h.calls[0].resolve("Une réponse complète\n\nÀ ton rythme. 👩🏽‍💻"); await flush(); h.render();
    const completedWords = h.all(node => node.props?.className === "nexo-chat-word");
    assert.equal(completedWords.map(node => node.props.children).join(""), "Une réponse complète\n\nÀ ton rythme. 👩🏽‍💻");
    assert.equal(completedWords[0].key, words[0].key, "revealed words keep their identity rather than restarting the fade");
    assert.equal(h.formState.content, "");
    assert.ok(h.button(send));
    h.button(clear).props.onClick(); h.render();
    assert.ok(h.button(send));
    assert.equal(h.all(node => node.type === "li").length, 0);
    h.unmount();
  });
}

test("Zod rejects blank/oversized drafts without consent or network; deliberate submit only", async () => {
  const h = await ui();
  for (const draft of ["  ", "x".repeat(2001)]) {
    h.formState.content = draft; h.render(); h.submit(); await flush(); h.render();
    assert.ok(h.formState.errors.content);
    assert.ok(h.button("Accepter et envoyer"));
  }
  assert.equal(h.calls.length, 0);
  h.formState.content = "Only typed"; h.render(); h.effects();
  assert.equal(h.calls.length, 0);
  h.unmount();
});

test("failure and cancellation preserve exact draft for explicit retry, never partial history", async () => {
  const h = await ui("en");
  h.formState.content = "  My draft\n "; h.render(); h.submit(); await flush();
  h.calls[0].onText("Partial"); h.calls[0].reject(new DemoApiError("response"));
  await flush(); h.render();
  assert.equal(h.formState.content, "  My draft\n ");
  assert.equal(h.all(node => node.type === "li").length, 0);
  h.submit(); await flush(); h.render();
  assert.equal(h.calls[1].messages.length, 1);
  h.button("Stop reply").props.onClick(); h.render();
  assert.equal(h.calls[1].signal.aborted, true);
  assert.equal(h.formState.content, "  My draft\n ");
  assert.equal(h.formState.focus, "content");
  await flush(); h.render(); h.submit(); await flush(); h.render();
  h.calls[1].onText("Late"); h.calls[1].resolve("Late"); await flush(); h.render();
  assert.ok(h.button("Stop reply"));
  assert.equal(h.formState.content, "");
  h.calls[2].resolve("Current"); await flush(); h.render();
  assert.equal(h.formState.content, "");
  h.unmount();
});

test("clear during streaming preserves visitor budget and ignores stale completion", async () => {
  const h = await ui("en");
  h.formState.content = "Old draft"; h.render(); h.submit(); await flush(); h.render();
  h.button("Clear conversation").props.onClick(); h.render();
  assert.equal(h.calls[0].signal.aborted, true);
  assert.ok(h.button("Send"));
  await flush(); h.render();
  h.formState.content = "New draft"; h.render(); h.submit(); await flush(); h.render();
  h.calls[0].resolve("Old reply"); await flush(); h.render();
  assert.equal(h.formState.content, "");
  assert.ok(h.button("Stop reply"));
  assert.equal(h.calls[1].messages.length, 1);
  h.calls[1].resolve("New reply"); await flush(); h.render();
  assert.equal(h.formState.content, "");
  assert.equal(h.all(node => node.type === "li").length, 2);
  h.unmount();
});

test("unmount invalidates validation and aborts streaming with no automatic restart", async () => {
  const validating = await ui();
  validating.formState.content = "Hello"; validating.render(); validating.submit(); validating.unmount();
  await flush(); assert.equal(validating.calls.length, 0);
  const streaming = await ui();
  streaming.formState.content = "Hello"; streaming.render(); streaming.submit(); await flush();
  streaming.unmount();
  assert.equal(streaming.calls[0].signal.aborted, true);
  streaming.calls[0].onText("Late"); streaming.calls[0].resolve("Late"); await flush();
  assert.equal(streaming.formState.content, "");
  const fr = streaming.exports.DemoChat({ locale: "fr" });
  const en = streaming.exports.DemoChat({ locale: "en" });
  assert.notEqual(fr.key, en.key, "locale remounts the owner");
  const activity = readFileSync(new URL("../components/demo-activities.tsx", import.meta.url), "utf8");
  assert.match(activity, /key=\{`\$\{activity\}-\$\{locale\}-\$\{generation\}`\}/);
});

test("Enter submits; Shift+Enter and IME composition (including Safari 229) do not", async () => {
  const h = await ui();
  let submits = 0;
  let prevented = 0;
  const keydown = h.find(node => node.type === "textarea").props.onKeyDown;
  const event = { key: "Enter", shiftKey: false, nativeEvent: { isComposing: false, keyCode: 13 }, preventDefault() { prevented++; }, currentTarget: { form: { requestSubmit() { submits++; } } } };
  keydown({ ...event, shiftKey: true });
  keydown({ ...event, nativeEvent: { isComposing: true } });
  keydown({ ...event, nativeEvent: { keyCode: 229 } });
  assert.equal(submits, 0); assert.equal(prevented, 0);
  keydown(event);
  assert.equal(submits, 1); assert.equal(prevented, 1);
  h.unmount();
});

test("stream follows only a reader near the bottom", async () => {
  const h = await ui();
  const node = { scrollHeight: 1000, scrollTop: 0, clientHeight: 300 };
  const region = h.find(element => element.props?.["data-chat-messages"] === true);
  region.props.ref.current = node;
  h.formState.content = "Hello"; h.render(); h.submit(); await flush(); h.render(); h.effects();
  assert.equal(node.scrollTop, 1000);
  node.scrollTop = 100;
  region.props.onScroll();
  h.calls[0].onText("Token"); h.render(); h.effects();
  assert.equal(node.scrollTop, 100);
  node.scrollTop = 650;
  region.props.onScroll();
  h.calls[0].onText("Token two"); h.render(); h.effects();
  assert.equal(node.scrollTop, 1000);
  h.unmount();
});

for (const code of ["rate_limited", "limit", "unavailable"]) {
  test(`${code} has a distinct actionable message, not history-full`, async () => {
    const h = await ui("en");
    h.formState.content = "Hello"; h.render(); h.submit(); await flush();
    h.calls[0].reject(new DemoApiError(code)); await flush(); h.render();
    const status = h.find(node => node.props?.role === "status").props.children;
    assert.match(status, code === "rate_limited" ? /wait.*clearing.*will not reset/i : code === "limit" ? /Shorten/ : /temporarily unavailable/);
    assert.doesNotMatch(status, /conversation is full/);
    h.unmount();
  });
}

for (const [locale, send, clear, plural, singular, continueLabel] of [
  ["fr", "Envoyer", "Effacer la conversation", "réponses restantes", "réponse restante", "Rejoindre la liste d’attente"],
  ["en", "Send", "Clear conversation", "replies remaining", "reply remaining", "Join the waitlist"],
]) {
  test(`${locale}: reply counter starts at 15, permits the 15th, blocks the 16th, and is not a timer`, async () => {
    let continued = 0;
    const h = await ui(locale, () => { continued++; });
    const count = () => h.find(node => node.props?.["data-chat-remaining"] === true).props.children[0];
    const counterText = () => JSON.stringify(h.find(node => node.props?.["data-chat-counter"] === true));
    assert.equal(count(), 15);
    assert.ok(counterText().includes(plural));
    assert.equal(h.all(node => node.props?.role === "timer").length, 0);
    assert.match(h.find(node => node.props?.["data-chat-counter"] === true).props.className, /sm:order-2/);
    assert.match(h.find(node => node.props?.["data-chat-counter"] === true).props.className, /lg:pl-10/);
    for (let i = 0; i < 15; i++) {
      assert.equal(continued, 0, "completion never navigates automatically");
      h.formState.content = `Hello ${i}`; h.render(); h.submit(); await flush();
      h.calls[i].onText("Partial"); h.render();
      assert.equal(count(), 15 - i, "streamed tokens do not consume a reply");
      if (i === 14) assert.ok(counterText().includes(singular));
      h.calls[i].resolve(`Reply ${i}`); await flush(); h.render();
      assert.equal(count(), 14 - i);
    }
    assert.equal(h.calls[14].messages.length, 29);
    assert.equal(h.all(node => node.type === "li").length, 30);
    assert.ok(h.find(node => node.type === "li" && node.props.children.includes("Hello 0")));
    h.formState.content = "Sixteenth"; h.render();
    assert.equal(h.button(send).props.disabled, true);
    assert.match(h.find(node => node.props?.role === "status").props.children, /15/);
    h.submit(); await flush(); assert.equal(h.calls.length, 15);
    h.find(node => node.type === "Button" && node.props.children === continueLabel).props.onClick();
    assert.equal(continued, 1);
    assert.equal(count(), 0);
    h.find(node => node.type === "Button" && node.props.children === clear).props.onClick(); h.render();
    assert.equal(count(), 0);
    assert.equal(h.all(node => node.type === "li").length, 0);
    assert.equal(h.formState.content, "Sixteenth");
    assert.equal(h.button(send).props.disabled, true);
    h.submit(); await flush(); assert.equal(h.calls.length, 15);
    h.unmount();
  });
}

test("failed and cancelled replies leave the visible quota unchanged", async () => {
  const h = await ui("en");
  const count = () => h.find(node => node.props?.["data-chat-remaining"] === true).props.children[0];
  h.formState.content = "Hello"; h.render(); h.submit(); await flush();
  h.calls[0].onText("Partial"); h.calls[0].reject(new DemoApiError("response")); await flush(); h.render();
  assert.equal(count(), 15);
  h.submit(); await flush(); h.render();
  h.calls[1].onText("Partial"); h.button("Stop reply").props.onClick(); h.render();
  assert.equal(count(), 15);
  h.calls[1].resolve("Stale"); await flush(); h.render();
  assert.equal(count(), 15);
  h.submit(); await flush(); h.calls[2].resolve("Complete"); await flush(); h.render();
  assert.equal(count(), 14);
  h.unmount();
});

test("chat has no countdown implementation; request timeouts are not a conversation timer", () => {
  const source = readFileSync(new URL("../components/demo-chat.tsx", import.meta.url), "utf8");
  const session = readFileSync(new URL("../lib/demo-chat.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source + session, /setInterval|setTimeout|Date\.now|performance\.now|role=\"timer\"|remainingSeconds/);
});
