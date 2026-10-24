"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { cellGeometry, createDoorTransition, doorTiming, focusDoorDestination, organicCell, type DoorCharacter, type DoorDestination } from "@/lib/door-transition";
import "./door-transition.css";

type TransitionContext = {
  begin: (href: DoorDestination, character: DoorCharacter, link: HTMLAnchorElement) => boolean;
  ready: (path: string) => void;
};
const Context = createContext<TransitionContext | null>(null);

export function DoorTransitionScope({ children, locale }: { children: ReactNode; locale: "fr" | "en" }) {
  const [pending, setPending] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const id = useId().replaceAll(":", "");
  const surface = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const cover = useRef<SVGGElement>(null);
  const opening = useRef<SVGGElement>(null);
  const gradient = useRef<SVGRadialGradientElement>(null);
  const controller = useRef<ReturnType<typeof createDoorTransition> | null>(null);
  const source = useRef<HTMLAnchorElement | null>(null);

  useLayoutEffect(() => {
    const layer = surface.current!;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const run = createDoorTransition({
      reduced: () => media.matches,
      hidden: () => document.hidden,
      supported: () => typeof cover.current?.animate === "function",
      prepare: ({ character, geometry }) => {
        layer.dataset.character = character;
        svg.current!.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);
        gradient.current!.setAttribute("cx", String(geometry.x));
        gradient.current!.setAttribute("cy", String(geometry.y));
        gradient.current!.setAttribute("r", String(geometry.radius));
        opening.current!.setAttribute("transform", "scale(0)");
      },
      phase: phase => { layer.dataset.phase = phase; },
      animate: (phase, { geometry: { x, y, radius }, character }) => {
        const node = phase === "covering" ? cover.current! : opening.current!;
        const tilt = character === "ciel" ? -9 : 9;
        // Measured viewport geometry belongs in WAAPI, not static/inlined layout styles.
        const animation = node.animate([
          { transform: `translate(${x}px, ${y}px) rotate(${tilt}deg) scale(0)` },
          { transform: `translate(${x}px, ${y}px) rotate(${-tilt / 2}deg) scale(${radius * .42}, ${radius * .39})`, offset: .5 },
          { transform: `translate(${x}px, ${y}px) rotate(0deg) scale(${radius})` },
        ], { duration: phase === "covering" ? doorTiming.cover : doorTiming.reveal, easing: "cubic-bezier(.45,0,.25,1)", fill: "both" });
        animations.add(animation);
        return animation;
      },
      push: href => router.push(href), // Keep Next's default scroll and focus management.
      focus: href => focusDoorDestination(document, source.current, href),
      schedule: (callback, delay) => {
        const timer = window.setTimeout(callback, delay);
        return () => window.clearTimeout(timer);
      },
      afterPaint: callback => {
        let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(callback); });
        return () => cancelAnimationFrame(frame);
      },
      reset: () => { animations.forEach(animation => animation.cancel()); animations.clear(); },
      pending: visible => {
        if (!visible) { setPending(false); return; }
        // This runs only from a timer/animation/interaction, never a React effect.
        // Install the loading bridge in the same paint that removes the shield.
        flushSync(() => {
          setPendingTarget(document.getElementById("main-content"));
          setPending(true);
        });
      },
    });
    controller.current = run;
    const expedite = () => run.expedite();
    const history = () => run.cancel();
    const visibility = () => { if (document.hidden) run.expedite(); };
    const preference = () => { if (media.matches) run.expedite(); };
    const keyboard = (event: KeyboardEvent) => {
      // No invisible keyboard trap; Tab continues natively to the newly visible page.
      if (event.key === "Tab" || event.key === "Escape") run.expedite();
    };
    const otherNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && !link.hasAttribute("data-door") && link.getAttribute("target") !== "_blank") run.cancel();
    };
    window.addEventListener("popstate", history);
    window.addEventListener("pagehide", history);
    window.addEventListener("resize", expedite);
    window.visualViewport?.addEventListener("resize", expedite);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("keydown", keyboard);
    document.addEventListener("click", otherNavigation, true);
    media.addEventListener("change", preference);
    return () => {
      run.cancel(); controller.current = null;
      window.removeEventListener("popstate", history);
      window.removeEventListener("pagehide", history);
      window.removeEventListener("resize", expedite);
      window.visualViewport?.removeEventListener("resize", expedite);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("click", otherNavigation, true);
      media.removeEventListener("change", preference);
    };
  }, [router]);
  useLayoutEffect(() => { controller.current?.route(pathname); }, [pathname]);

  const begin = useCallback((href: DoorDestination, character: DoorCharacter, link: HTMLAnchorElement) => {
    const avatar = link.querySelector("[data-avatar]");
    if (!avatar || !surface.current) return false;
    const rect = avatar.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    source.current = link;
    return controller.current?.begin({ href, character, geometry: cellGeometry(rect.x + rect.width / 2, rect.y + rect.height / 2, window.innerWidth, window.innerHeight) }) ?? false;
  }, []);
  const ready = useCallback((path: string) => { controller.current?.ready(path); }, []);

  return <Context.Provider value={{ begin, ready }}>
    {children}
    {pending && pendingTarget && createPortal(<div data-door-pending className="door-pending">
      <p role="status">{locale === "fr" ? "Nexo prépare ton espace…" : "Nexo is preparing your space…"}</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center underline underline-offset-4">{locale === "fr" ? "Revenir aux deux portes" : "Return to both doors"}</Link>
    </div>, pendingTarget)}
    <div ref={surface} className="door-transition" data-door-transition data-phase="idle" aria-hidden="true">
      <svg ref={svg} className="door-transition-canvas" xmlns="http://www.w3.org/2000/svg" focusable="false" preserveAspectRatio="none">
        <defs>
          <radialGradient ref={gradient} id={`${id}-color`} gradientUnits="userSpaceOnUse">
            <stop offset="0" className="door-cell-center" />
            <stop offset=".46" className="door-cell-middle" />
            <stop offset=".78" className="door-cell-color" />
            <stop offset="1" className="door-cell-edge" />
          </radialGradient>
          <mask id={`${id}-cover`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <g ref={cover}><path d={organicCell} fill="white" /></g>
          </mask>
          <mask id={`${id}-opening`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <rect width="100%" height="100%" fill="white" />
            <g ref={opening} transform="scale(0)"><path d={organicCell} fill="black" /></g>
          </mask>
        </defs>
        <rect className="door-cell-cover" width="100%" height="100%" fill={`url(#${id}-color)`} mask={`url(#${id}-cover)`} />
        <rect className="door-cell-opening" width="100%" height="100%" fill={`url(#${id}-color)`} mask={`url(#${id}-opening)`} />
      </svg>
    </div>
  </Context.Provider>;
}

type DoorLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onNavigate" | "ref"> & { href: DoorDestination; character: DoorCharacter };
export function DoorLink({ href, character, ...props }: DoorLinkProps) {
  const context = useContext(Context);
  const link = useRef<HTMLAnchorElement>(null);
  return <Link {...props} ref={link} href={href} onNavigate={event => {
    // onNavigate runs only for same-tab client navigation: Enter works, modifiers,
    // middle-click, downloads, new tabs and no-JS navigation remain native Links.
    if (link.current && context?.begin(href, character, link.current)) event.preventDefault();
  }} />;
}

// Mount ONLY alongside committed page/error content, never in loading.tsx. A pathname
// change alone can mean a Suspense fallback, not a hydrated destination.
export function DoorRouteReady({ path }: { path?: string }) {
  const context = useContext(Context);
  const pathname = usePathname();
  const destination = path ?? pathname;
  const ready = context?.ready;
  useLayoutEffect(() => { ready?.(destination); }, [ready, destination]);
  return <span hidden data-door-route-ready={destination} />;
}
