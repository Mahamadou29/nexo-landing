import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import * as api from "../lib/demo-api.ts";
import * as reveal from "../lib/chat-text-reveal.ts";

// Same dependency-free TSX / hook adapter approach as realtime-voice-ui.test.mjs.
function compile(path, imports, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, AbortController, ...globals, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
export const visitor = compile("../lib/demo-chat-visitor.ts", { "./demo-api": api });
export const VISITOR_ID = "12345678-1234-4234-8234-123456789abc";
export const chat = compile("../lib/demo-chat.ts", { "./demo-api": api, "./demo-chat-visitor": visitor, "./chat-text-reveal": reveal });
export function deferredSend(remaining = 15) {
  const calls = [];
  const quotaCalls = [];
  const backend = { remaining, quotaError: null };
  return { calls, quotaCalls, backend, async getQuota(options) {
    quotaCalls.push(options);
    if (backend.quotaError) throw backend.quotaError;
    return backend.remaining;
  }, send(options) {
    return new Promise((resolve, reject) => calls.push({ ...options, resolve(value) {
      if (typeof value === "string") {
        if (!options.signal.aborted) backend.remaining--;
        resolve({ text: value, remaining: backend.remaining });
      } else { backend.remaining = value.remaining; resolve(value); }
    }, reject }));
  } };
}
export const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
export const plain = value => JSON.parse(JSON.stringify(value));

export function mountUi(locale = "fr", onContinue, options = {}) {
  const transport = deferredSend(options.remaining ?? 15);
  transport.backend.quotaError = options.quotaError ?? null;
  const listeners = new Map();
  const browser = { visibilityState: "visible", addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } };
  const slots = [];
  const effects = [];
  const portals = [];
  const target = {};
  const formState = { content: "", errors: {}, focus: null };
  let cursor = 0;
  let formOptions;
  const form = {
    control: {},
    getValues() { return formState.content; },
    setValue(_name, value) { formState.content = value; },
    reset(values) { formState.content = values.content; formState.errors = {}; },
    setFocus(name) { formState.focus = name; },
    clearErrors() { formState.errors = {}; },
    handleSubmit(callback) { return async event => {
      event.preventDefault();
      const result = await formOptions.resolver({ content: formState.content }, {}, { fields: {}, shouldUseNativeValidation: false });
      formState.errors = result.errors;
      if (!Object.keys(result.errors).length) await callback(result.values);
    }; },
  };
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) {
      const i = cursor++;
      slots[i] ??= { value: typeof value === "function" ? value() : value };
      return [slots[i].value, next => { slots[i].value = typeof next === "function" ? next(slots[i].value) : next; }];
    },
    useId() { const i = cursor++; return slots[i] ??= `chat-id-${i}`; },
    useMemo(factory, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, index) => dep !== slots[i].deps[index])) slots[i] = { deps, value: factory() };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, index) => dep !== slots[i].deps[index])) {
        const previous = slots[i];
        slots[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  class Session extends chat.DemoChatSession {
    constructor(locale, onState, deps) { super(locale, onState, { ...deps, send: transport.send, getQuota: options.getQuota ?? transport.getQuota, getVisitor: () => { if (options.storageError) throw options.storageError; return VISITOR_ID; } }); }
  }
  const exports = compile("../components/demo-chat.tsx", {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-dom": { createPortal(node, destination) { portals.push({ node, destination }); return node; } },
    "next/image": { default: "Image" }, "next/link": { default: "Link" },
    "next/navigation": { usePathname: () => "/experience" },
    "react-hook-form": { useForm(options) { formOptions = options; return form; }, useWatch() { return formState.content; } },
    "@hookform/resolvers/zod": { zodResolver }, zod: { z },
    "lucide-react": { ArrowUp: "ArrowUp", RotateCcw: "RotateCcw", Square: "Square" },
    "@/components/landing-provider": { useLanding: () => ({ voiceNoticeTarget: target }) },
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/form": Object.fromEntries(["Form", "FormControl", "FormDescription", "FormField", "FormItem", "FormLabel", "FormMessage"].map(name => [name, name])),
    "@/lib/demo-api": api,
    "@/lib/demo-chat": { ...chat, DemoChatSession: Session },
    "@/lib/demo-chat-visitor": visitor,
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
  }, { window: browser, document: browser });
  const wrapper = exports.DemoChat({ locale, onContinue });
  let tree;
  function render() {
    cursor = 0;
    tree = wrapper.type(wrapper.props);
    return tree;
  }
  function walk(node, output = []) {
    if (!node || typeof node !== "object") return output;
    if (Array.isArray(node)) { node.forEach(child => walk(child, output)); return output; }
    output.push(node);
    if (node.type === "FormField") walk(node.props.render({ field: { value: formState.content, name: "content", onChange: event => { formState.content = event.target.value; } } }), output);
    walk(node.props?.children, output);
    return output;
  }
  render();
  const result = {
    ...transport, formState, portals, target, exports, render, listeners,
    type(text) { result.find(node => node.type === "textarea").props.onChange({ target: { value: text } }); render(); },
    effects() { effects.splice(0).forEach(effect => effect()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    find(predicate) { return walk(tree).find(predicate); },
    all(predicate) { return walk(tree).filter(predicate); },
    submit() { result.find(node => node.type === "form").props.onSubmit({ preventDefault() {} }); },
    button(label) { return result.find(node => node.type === "Button" && node.props["aria-label"] === label); },
  };
  result.effects();
  return result;
}

export async function ui(locale = "fr", onContinue, options) {
  const result = mountUi(locale, onContinue, options);
  await flush();
  result.render();
  return result;
}
