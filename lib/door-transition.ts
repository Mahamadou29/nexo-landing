// The controller is DOM/React independent so cancellation and navigation races are testable.
export type DoorDestination = "/decouvrir" | "/experience";
export type DoorCharacter = "ciel" | "noir";
export type DoorPhase = "idle" | "covering" | "waiting" | "revealing";
export const doorTiming = { cover: 1000, reveal: 1400, deadline: 3000 } as const;
export const organicCell = "M 0 -0.94 C 0.49 -1.05 0.95 -0.68 0.98 -0.17 C 1.05 0.35 0.67 0.87 0.19 0.98 C -0.30 1.08 -0.87 0.76 -0.97 0.25 C -1.08 -0.25 -0.66 -0.84 0 -0.94 Z";

export function cellGeometry(x: number, y: number, width: number, height: number) {
  const originX = Math.max(0, Math.min(width, x));
  const originY = Math.max(0, Math.min(height, y));
  // The cell contains a radius .7 disk, including every intermediate rotated shape.
  const radius = Math.hypot(Math.max(originX, width - originX), Math.max(originY, height - originY)) / .7 + 4;
  return { x: originX, y: originY, radius, width, height };
}
// Focus is deliberately conservative: Next's own focus or a user's choice wins.
export function focusDoorDestination(document: Pick<Document, "getElementById" | "activeElement" | "body">, source: HTMLElement | null, href: DoorDestination) {
  const main = document.getElementById("main-content");
  if (!main?.querySelector(`[data-door-route-ready="${href}"]`)) return;
  const active = document.activeElement;
  if (active !== document.body && active !== source && active?.isConnected) return;
  const target = Array.from(main.querySelectorAll<HTMLElement>("h1")).find(heading => heading.getClientRects().length > 0) ?? main;
  const oldTabIndex = target.getAttribute("tabindex");
  if (oldTabIndex === null) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  if (oldTabIndex === null) {
    // Removing tabindex while focused sends Chromium's focus back to the body.
    const restore = () => target.removeAttribute("tabindex");
    if (document.activeElement === target) target.addEventListener("blur", restore, { once: true });
    else restore();
  }
}

export type CellGeometry = ReturnType<typeof cellGeometry>;
export type DoorRequest = { href: DoorDestination; character: DoorCharacter; geometry: CellGeometry };
type AnimationHandle = { finished: Promise<unknown>; cancel: () => void };
type Driver = {
  reduced: () => boolean;
  hidden: () => boolean;
  supported: () => boolean;
  prepare: (request: DoorRequest) => void;
  phase: (phase: DoorPhase) => void;
  animate: (phase: "covering" | "revealing", request: DoorRequest) => AnimationHandle;
  push: (href: DoorDestination) => void;
  focus: (href: DoorDestination) => void;
  schedule: (callback: () => void, delay: number) => () => void;
  afterPaint: (callback: () => void) => () => void;
  reset: () => void;
  pending: (visible: boolean) => void;
};

export function createDoorTransition(driver: Driver) {
  let path = "/";
  let serial = 0;
  let active: { id: number; request: DoorRequest; phase: DoorPhase; pushed: boolean; ready: boolean } | null = null;
  let animation: AnimationHandle | null = null;
  let cancelDeadline: (() => void) | undefined;
  let cancelPaint: (() => void) | undefined;
  let pendingFocus: DoorDestination | null = null;

  function clear() {
    pendingFocus = null;
    driver.pending(false);
    active = null; // Invalidate before cancelling the animation's rejected promise.
    animation?.cancel(); animation = null;
    cancelDeadline?.(); cancelDeadline = undefined;
    cancelPaint?.(); cancelPaint = undefined;
    driver.reset();
    driver.phase("idle");
  }
  function finish() {
    const href = active?.request.href;
    const ready = active?.ready;
    const pushed = active?.pushed;
    clear();
    if (href === path && ready) driver.focus(href);
    else if (href && pushed) {
      pendingFocus = href;
      // After the motion budget, show an accessible, non-blocking loading bridge
      // instead of flashing the old home or holding a full-screen pointer shield.
      driver.pending(path === "/");
    }
  }
  function push() {
    if (!active || active.pushed) return;
    active.pushed = true;
    try { driver.push(active.request.href); } catch { clear(); }
  }
  function reveal() {
    const run = active;
    if (!run || run.phase !== "waiting" || !run.ready || path !== run.request.href) return;
    run.phase = "revealing";
    // Let App Router finish its scroll/focus pass before revealing the committed DOM.
    cancelPaint = driver.afterPaint(() => {
      if (active?.id !== run.id) return;
      if (driver.hidden() || driver.reduced()) { finish(); return; }
      driver.phase("revealing");
      try {
        animation = driver.animate("revealing", run.request);
        void animation.finished.then(() => { if (active?.id === run.id) finish(); }, () => { if (active?.id === run.id) finish(); });
      } catch { finish(); }
    });
  }
  return {
    // true means this same-tab Link navigation is owned (including duplicate clicks).
    begin(request: DoorRequest) {
      if (active) return true;
      if (path !== "/" || driver.reduced() || driver.hidden() || !driver.supported()) return false;
      clear();
      const run = { id: ++serial, request, phase: "covering" as DoorPhase, pushed: false, ready: false };
      active = run;
      try {
        driver.prepare(request);
        driver.phase("covering");
        cancelDeadline = driver.schedule(() => {
          if (active?.id !== run.id) return;
          // Never let a failed request or suspended animation hold the application hostage.
          push();
          finish();
        }, doorTiming.deadline);
        animation = driver.animate("covering", request);
        void animation.finished.then(() => {
          if (active?.id !== run.id) return;
          run.phase = "waiting";
          driver.phase("waiting"); // Fully opaque BEFORE any router mutation.
          push();
          reveal();
        }, () => {
          if (active?.id !== run.id) return;
          push();
          finish();
        });
        return true;
      } catch {
        clear();
        return false; // Let the original Link navigate if optional animation setup fails.
      }
    },
    route(next: string) {
      const previous = path;
      path = next;
      if (next === "/" && previous !== "/") { clear(); return; }
      if (active && !active.pushed && next !== "/") { clear(); return; }
      if (next !== "/") driver.pending(false);
      if (pendingFocus && next !== "/" && next !== pendingFocus) clear();
      if (!active) return;
      if (next !== "/" && next !== active.request.href) { clear(); return; }
      if (next === "/" && active.phase === "revealing") { clear(); return; }
      reveal();
    },
    ready(next: string) {
      if (pendingFocus === next) {
        const href = pendingFocus;
        cancelPaint = driver.afterPaint(() => {
          if (pendingFocus !== href || path !== href) return;
          pendingFocus = null;
          driver.pending(false);
          driver.focus(href);
        });
      }
      if (!active || next !== active.request.href || !active.pushed) return;
      active.ready = true;
      reveal();
    },
    // Resize, reduced-motion changes and hiding a tab finish the intent without replay.
    expedite() { if (active) { push(); finish(); } },
    // History / unrelated navigation / unmount must NOT send a delayed push or steal focus.
    cancel: clear,
    get phase() { return active?.phase ?? "idle"; },
  };
}
