"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { advanceBubbleAge, bubbleLifetime } from "@/lib/experience-flow";
import { moodFlightFrames, type MoodExit } from "@/lib/mood-flight";
import { clampPoint, driftStep, dropDestination, type Point, type Space } from "@/lib/mood-space";

type Props = { id: number; text: string; exit: MoodExit; locale: "fr" | "en"; stamped: boolean; onStamp: () => void };
type Drag = { id: number; start: Point; origin: Point; moved: boolean };
type Controller = { freeze: () => void; move: (point: Point) => void; resize: () => void };

export function MoodDrop({ id, text, exit, locale, stamped, onStamp }: Props) {
  const helpId = useId();
  const onStampRef = useRef(onStamp);
  useLayoutEffect(() => { onStampRef.current = onStamp; }, [onStamp]);
  const flight = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const suppressClick = useRef(false);
  const interaction = useRef({ hovered: false, focused: false, stamped, drag: null as Drag | null });

  useLayoutEffect(() => {
    interaction.current.stamped = stamped;
    if (stamped) controller.current?.freeze();
    controller.current?.resize();
  }, [stamped]);

  useLayoutEffect(() => {
    const element = flight.current;
    if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const space = (): Space => {
      const top = Math.max(16, (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 16);
      return { left: 16, top, right: Math.max(16, innerWidth - element.offsetWidth - 16), bottom: Math.max(top, innerHeight - element.offsetHeight - 16) };
    };
    let point = dropDestination(exit, element.offsetWidth, element.offsetHeight, space());
    let velocity = { x: (exit.dx || (Math.random() < 0.5 ? -1 : 1)) * 44, y: (exit.dy || (Math.random() < 0.5 ? -1 : 1)) * 34 };
    const stationary = () => [0, 1].map(offset => ({ offset, transform: `translate(${point.x}px, ${point.y}px)` }));
    const motion = element.animate(stationary(), { duration: 1, fill: "both" });
    motion.pause();
    const paint = () => {
      if (motion.effect instanceof KeyframeEffect) motion.effect.setKeyframes(stationary());
    };
    let arrival: Animation | null = reduced.matches ? null : element.animate(
      moodFlightFrames(exit, { left: point.x, top: point.y, width: element.offsetWidth, height: element.offsetHeight }, innerWidth)
        .map(frame => ({ ...frame, transform: `translate(${point.x}px, ${point.y}px) ${frame.transform}` })),
      { duration: 1350, easing: "cubic-bezier(0.22, 0.7, 0.3, 1)" },
    );
    if (arrival) arrival.onfinish = () => { arrival = null; };
    const freeze = () => {
      if (arrival) {
        const rect = element.getBoundingClientRect();
        arrival.cancel(); arrival = null;
        point = clampPoint({ x: rect.left, y: rect.top }, space());
        paint();
      }
    };
    const resize = () => { freeze(); point = clampPoint(point, space()); paint(); };
    controller.current = { freeze, resize, move: next => { freeze(); point = clampPoint(next, space()); paint(); } };
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { hovered, focused, stamped: placed, drag } = interaction.current;
      if (!arrival && !reduced.matches && !hovered && !focused && !placed && !drag) {
        const next = driftStep(point, velocity, seconds, space());
        point = next.point; velocity = next.velocity; paint();
      }
      if (!reduced.matches && !interaction.current.stamped) frame = requestAnimationFrame(tick);
    };
    const preference = () => { freeze(); cancelAnimationFrame(frame); last = performance.now(); if (!reduced.matches && !interaction.current.stamped) frame = requestAnimationFrame(tick); };
    if (!reduced.matches) frame = requestAnimationFrame(tick);
    const lifetime = bubbleLifetime(Math.random());
    let age = 0;
    let ageUpdated = performance.now();
    const settle = setInterval(() => {
      const now = performance.now();
      const state = interaction.current;
      age = advanceBubbleAge(age, now - ageUpdated, document.hidden || state.hovered || state.focused || !!state.drag);
      ageUpdated = now;
      if (state.stamped) { clearInterval(settle); return; }
      if (age < lifetime) return;
      freeze();
      state.stamped = true;
      clearInterval(settle);
      onStampRef.current();
    }, 100);
    let observedWidth = element.offsetWidth, observedHeight = element.offsetHeight;
    const observer = new ResizeObserver(() => {
      if (element.offsetWidth === observedWidth && element.offsetHeight === observedHeight) return;
      observedWidth = element.offsetWidth; observedHeight = element.offsetHeight;
      resize();
    });
    observer.observe(element);
    reduced.addEventListener("change", preference);
    window.addEventListener("resize", resize);
    return () => { clearInterval(settle); observer.disconnect(); cancelAnimationFrame(frame); arrival?.cancel(); motion.cancel(); controller.current = null; reduced.removeEventListener("change", preference); window.removeEventListener("resize", resize); };
  }, [exit]);

  return <div ref={flight} data-mood-id={id} data-stamped={stamped} className="mood-drop-flight pointer-events-none fixed top-0 left-0 z-40 w-fit">
    {stamped ? <div className="mood-stamp w-[min(20rem,calc(100vw-2rem))] text-left text-navy/70" role="note">
      <p className={`${text.length > 120 ? "text-xs leading-4 sm:text-sm sm:leading-5" : "text-base leading-6 sm:text-xl sm:leading-7"} whitespace-pre-wrap [overflow-wrap:anywhere]`}>{text}</p>
    </div> : <button type="button" className="mood-bubble pointer-events-auto relative flex h-[clamp(6rem,14vw,8rem)] w-[clamp(10rem,26vw,14rem)] touch-none cursor-grab items-center justify-center px-7 py-5 text-sm font-light text-navy select-none active:cursor-grabbing" aria-label={locale === "fr" ? `Déplacer ces mots : ${text}` : `Move these words: ${text}`} aria-describedby={helpId}
      onPointerEnter={event => { if (event.pointerType !== "touch") { interaction.current.hovered = true; controller.current?.freeze(); } }}
      onPointerLeave={() => { interaction.current.hovered = false; }}
      onFocus={() => { interaction.current.focused = true; controller.current?.freeze(); }}
      onBlur={() => { interaction.current.focused = false; }}
      onPointerDown={event => {
        if (event.button !== 0 || interaction.current.drag) return;
        suppressClick.current = false;
        event.preventDefault(); controller.current?.freeze(); event.currentTarget.focus({ preventScroll: true });
        const rect = flight.current?.getBoundingClientRect();
        if (!rect) return;
        interaction.current.drag = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: rect.left, y: rect.top }, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = interaction.current.drag;
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.start.x, dy = event.clientY - drag.start.y;
        drag.moved ||= Math.hypot(dx, dy) > 4;
        controller.current?.move({ x: drag.origin.x + dx, y: drag.origin.y + dy });
      }}
      onPointerUp={event => {
        const drag = interaction.current.drag;
        if (!drag || drag.id !== event.pointerId) return;
        interaction.current.drag = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (drag.moved) { suppressClick.current = true; onStamp(); }
      }}
      onPointerCancel={() => { interaction.current.drag = null; suppressClick.current = true; }}
      onLostPointerCapture={() => { if (interaction.current.drag) { interaction.current.drag = null; suppressClick.current = true; } }}
      onKeyDown={event => {
        if (event.key === "Escape") { if (interaction.current.drag) { interaction.current.drag = null; suppressClick.current = true; } event.stopPropagation(); return; }
        const delta: Record<string, Point> = { ArrowLeft: { x: -24, y: 0 }, ArrowRight: { x: 24, y: 0 }, ArrowUp: { x: 0, y: -24 }, ArrowDown: { x: 0, y: 24 } };
        const move = delta[event.key];
        if (!move || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault(); event.stopPropagation(); controller.current?.freeze();
        const rect = flight.current?.getBoundingClientRect();
        if (rect) controller.current?.move({ x: rect.left + move.x, y: rect.top + move.y });
      }}
      onClick={event => {
        if (event.detail > 0 && suppressClick.current) { suppressClick.current = false; return; }
        suppressClick.current = false; onStamp();
      }}>
      <span className="relative line-clamp-3 [overflow-wrap:anywhere]">{text}</span>
    </button>}
    <span id={helpId} className="sr-only">{locale === "fr" ? "Glisse la bulle et relâche-la pour tamponner. Au clavier : flèches pour la déplacer, Entrée ou Espace pour tamponner." : "Drag and release to stamp. With the keyboard: arrows to move, Enter or Space to stamp."}</span>
  </div>;
}
