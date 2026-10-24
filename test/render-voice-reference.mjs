// Static inspection of the actual server-rendered button. No server, microphone or provider.
// Run: node test/render-voice-reference.mjs
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import sharp from "sharp";
import { createVoiceCells, VOICE_VIEWBOX } from "../lib/voice-cell-geometry.ts";
import { VoiceSignal, VOICE_BANDS } from "../lib/voice-signal.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../components/voice-waveform.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require(name) {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return require(name);
  if (name === "@/lib/voice-cell-geometry") return { createVoiceCells, VOICE_VIEWBOX };
  if (name === "@/lib/voice-signal") return { VoiceSignal, VOICE_BANDS };
  throw new Error(`Unexpected runtime dependency: ${name}`);
} });
const markup = renderToStaticMarkup(React.createElement(exports.VoiceWaveformSvg, { ref: { current: null } }));
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map(match => [match[1], match[2]]));
// Resolve the component's sRGB mixes for non-browser SVG viewers (e.g. librsvg).
function resolve(value) {
  let result = value.replace(/var\((--[\w-]+)\)/g, (_, name) => tokens[name]);
  const mix = /color-mix\(in srgb,\s*(#[\da-f]{6})\s*([\d.]+)%,\s*(#[\da-f]{6})\)/gi;
  while (result.includes("color-mix")) {
    const next = result.replace(mix, (_, a, weight, b) => {
      const amount = Number(weight) / 100;
      return "#" + [1, 3, 5].map(index => Math.round(parseInt(a.slice(index, index + 2), 16) * amount + parseInt(b.slice(index, index + 2), 16) * (1 - amount)).toString(16).padStart(2, "0")).join("");
    });
    if (next === result) throw new Error(`Unresolved color: ${result}`);
    result = next;
  }
  return result;
}
const svg = markup.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/stop-color="([^"]+)"/g, (_, value) => `stop-color="${resolve(value)}"`);
const destination = new URL("../docs/voice-rest-preview.svg", import.meta.url);
writeFileSync(destination, svg);
await sharp(Buffer.from(svg)).resize(1200, 360).flatten({ background: tokens["--background"] }).png().toFile("/tmp/nexo-voice-rest-preview.png");
console.log(`Actual resting SVG: ${destination.pathname}\nRaster inspection: /tmp/nexo-voice-rest-preview.png`);
