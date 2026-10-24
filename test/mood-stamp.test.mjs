import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = readFileSync(new URL("../components/mood-stamp.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
}).outputText.replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
const { MoodStamp } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const moment = { id: 1, text: "Un peu plus serein", createdAt: Date.parse("2026-10-23T20:46:00Z") };

for (const locale of ["fr", "en"]) {
  test(`the ${locale} imprint renders words and the original submission time, without a bubble`, () => {
    const html = renderToStaticMarkup(createElement(MoodStamp, { moment, locale }));
    assert.match(html, /role="note"/);
    assert.match(html, /Un peu plus serein<\/p><time/);
    assert.match(html, /dateTime="2026-10-23T20:46:00.000Z"/);
    const formatted = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(moment.createdAt));
    assert.ok(html.includes(formatted));
    assert.doesNotMatch(html, /<button|mood-bubble|draggable/);
    assert.equal(html, renderToStaticMarkup(createElement(MoodStamp, { moment, locale })));
  });
}

test("long words retain accessible text and submitted markup is escaped", () => {
  const text = "<script>alert('test')</script>" + "a".repeat(260);
  const html = renderToStaticMarkup(createElement(MoodStamp, { moment: { ...moment, text }, locale: "fr" }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(html.includes("a".repeat(260)));
});
