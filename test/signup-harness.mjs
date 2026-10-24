import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { zodResolver } from "@hookform/resolvers/zod";
import * as api from "../lib/landing-api.ts";
import * as schema from "../lib/signup-schema.ts";

// Existing Node TSX/hook-adapter convention. Real Zod resolver and HTTP transport,
// injected fetch only: these tests must never contact the registration service.
export const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
export const plain = value => JSON.parse(JSON.stringify(value));
export function mountSignup(locale = "fr", ready = true) {
  const source = readFileSync(new URL("../components/signup-form.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const slots = [], effects = [], calls = [];
  let cursor = 0, tree, formOptions, focus = null, resetCount = 0, headingFocusCount = 0;
  let values = { email: "", phone: "", note: "", consent: false };
  const form = {
    control: {}, errors: {},
    clearErrors() { form.errors = {}; },
    setValue(name, value) { values[name] = value; },
    setFocus(name) { focus = name; },
    reset() { values = { ...formOptions.defaultValues }; form.errors = {}; resetCount++; },
    handleSubmit(callback, invalid) { return async event => {
      event.preventDefault();
      const result = await formOptions.resolver(values, {}, { fields: {}, shouldUseNativeValidation: false });
      form.errors = result.errors;
      if (Object.keys(result.errors).length) invalid?.(result.errors);
      else await callback(result.values);
    }; },
  };
  const react = {
    useId() { return `signup-id-${cursor++}`; },
    useSyncExternalStore(_subscribe, snapshot, serverSnapshot) { return ready ? snapshot() : serverSnapshot(); },
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) {
      const index = cursor++;
      slots[index] ??= { value };
      return [slots[index].value, next => { slots[index].value = next; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) {
        const previous = slots[index];
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { default: "Link" },
    "lucide-react": Object.fromEntries(["ArrowRight", "Check", "Mail", "ShieldCheck", "Smartphone"].map(name => [name, name])),
    "react-hook-form": { useForm(options) { formOptions = options; return form; } },
    "@hookform/resolvers/zod": { zodResolver },
    "@/lib/signup-schema": schema,
    "@/lib/landing-api": api,
    "@/lib/utils": { cn: (...args) => args.filter(Boolean).join(" ") },
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/input": { Input: "Input" },
    "@/components/ui/form": Object.fromEntries(["Form", "FormControl", "FormDescription", "FormField", "FormItem", "FormLabel", "FormMessage"].map(name => [name, name])),
    "./signup.css": {},
  };
  const exports = {};
  vm.runInNewContext(code, { exports, AbortController, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => calls.push({ url, options, resolve, reject }));
  function walk(node, output = []) {
    if (!node || typeof node !== "object") return output;
    if (Array.isArray(node)) { node.forEach(child => walk(child, output)); return output; }
    output.push(node);
    if (typeof node.type === "function") walk(node.type(node.props), output);
    if (node.type === "FormField") walk(node.props.render({ field: {
      name: node.props.name, value: values[node.props.name],
      onChange(event) { values[node.props.name] = event?.target ? event.target.value : event; },
      onBlur() {}, ref() {},
    } }), output);
    walk(node.props?.children, output);
    return output;
  }
  const result = {
    calls, form,
    get values() { return values; }, get focus() { return focus; },
    get resetCount() { return resetCount; }, get headingFocusCount() { return headingFocusCount; },
    render(nextLocale = locale) {
      locale = nextLocale; cursor = 0; tree = exports.SignupForm({ locale });
      const heading = walk(tree).find(node => node.type === "h3" && node.props.tabIndex === -1);
      if (heading) heading.props.ref.current = { focus() { headingFocusCount++; } };
      effects.splice(0).forEach(effect => effect());
      return tree;
    },
    all(predicate) { return walk(tree).filter(predicate); },
    find(predicate) { return walk(tree).find(predicate); },
    get state() { return tree.props["data-signup-state"]; },
    text() { return walk(tree).flatMap(node => {
      const children = node.props.children;
      return Array.isArray(children) ? children.filter(value => typeof value === "string") : typeof children === "string" ? [children] : [];
    }).join(" "); },
    type(name, value) {
      const node = result.find(node => node.props.name === name && ["Input", "textarea", "input"].includes(node.type));
      node.props.onChange({ target: { value, checked: value } }); result.render();
    },
    switchCountry(country) { result.find(node => node.type === "select" && node.props.name === "phoneCountry").props.onChange({ target: { value: country } }); result.render(); },
    switchKind(kind) { result.all(node => node.type === "Button" && node.props["aria-pressed"] !== undefined)[kind === "email" ? 0 : 1].props.onClick(); result.render(); },
    submit() { result.find(node => node.type === "form").props.onSubmit({ preventDefault() {} }); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    dispose() { result.unmount(); globalThis.fetch = originalFetch; },
  };
  result.render();
  return result;
}
