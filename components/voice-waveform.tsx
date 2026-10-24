"use client";

import { useEffect, useId, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import type { VoiceState, VoiceWaveform } from "@/lib/realtime-voice";
import { VoiceSignal, VOICE_BANDS, type VoiceSignalSettings } from "@/lib/voice-signal";
import { createVoiceCells, VOICE_VIEWBOX } from "@/lib/voice-cell-geometry";

type VisualState = Pick<VoiceState, "status" | "muted">;
export type VoiceWaveformHandle = {
  draw: (waveform: VoiceWaveform | null) => void;
  setState: (state: VisualState) => void;
};
export type VoiceWaveformProps = VoiceSignalSettings & {
  ref: Ref<VoiceWaveformHandle>;
  columns?: number;
  spacing?: number;
  palette?: readonly [string, string, string, string, string];
  deformation?: number;
};
const PALETTE = ["var(--voice-cell-1)", "var(--voice-cell-2)", "var(--voice-cell-3)", "var(--voice-cell-4)", "var(--voice-cell-5)"] as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const noop = () => {};

/** One stable object: a finite consent/session morph, then only measured audio movement. */
export function VoiceWaveformSvg({ ref, columns = 23, spacing = 1, palette = PALETTE, deformation = 0.12, sensitivity, silenceThreshold, smoothing }: VoiceWaveformProps) {
  const svg = useRef<SVGSVGElement | null>(null);
  const microphone = useRef<SVGGElement | null>(null);
  const nodes = useRef<(SVGGElement | null)[]>([]);
  const stops = useRef<(SVGStopElement | null)[]>([]);
  const visual = useRef<VisualState>({ status: "idle", muted: false });
  const paint = useRef<VoiceWaveformHandle>({ draw: noop, setState: noop });
  const id = useId();
  const count = Math.round(clamp(columns, 19, 27));
  const gap = clamp(spacing, 0.8, 1.12);
  const bend = clamp(deformation, 0, 0.25);
  const cells = useMemo(() => createVoiceCells(count, gap), [count, gap]);
  const colors = useMemo(() => cells.map((cell, index) => {
    const position = cell.column / (count - 1) * 4;
    const lower = Math.min(3, Math.floor(position));
    const active = `color-mix(in srgb, ${palette[lower]} ${(1 - (position - lower)) * 100}%, ${palette[lower + 1]})`;
    const blue = `color-mix(in srgb, var(--voice-rest-blue) ${76 + index * 7 % 19}%, var(--voice-rest-light))`;
    const resting = cell.ivory ? "var(--ivory)" : blue;
    return {
      resting: [
        `color-mix(in srgb, ${resting} 38%, var(--ivory))`, resting,
        `color-mix(in srgb, ${resting} ${cell.ivory ? 92 : 66}%, var(--voice-rest-deep))`,
      ],
      active: [
        `color-mix(in srgb, ${active} 87%, var(--ivory))`, active,
        `color-mix(in srgb, ${active} 94%, var(--voice-cell-5))`,
      ],
    };
  }), [cells, count, palette]);
  const attackMs = smoothing?.attackMs;
  const releaseMs = smoothing?.releaseMs;
  useImperativeHandle(ref, () => ({ draw: samples => paint.current.draw(samples), setState: state => paint.current.setState(state) }), []);

  useEffect(() => {
    const signal = new VoiceSignal({ sensitivity, silenceThreshold, smoothing: { attackMs: attackMs ?? 65, releaseMs: releaseMs ?? 240 } });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    const active = () => visual.current.status === "listening" || visual.current.status === "speaking";
    const sessionOpen = () => active() || visual.current.status === "connecting";
    let target = sessionOpen() ? 1 : 0;
    let amount = target;
    let from = target;
    let began = 0;
    let morphing = false;
    const returningLevels = new Float32Array(VOICE_BANDS);
    let paintedAmount = -1;
    const mix = (a: number, b: number) => a + (b - a) * amount;
    const cancel = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
    function advanceMorph(now: number) {
      if (!morphing) return;
      const progress = clamp((now - began) / 560, 0, 1);
      amount = from + (target - from) * progress * progress * (3 - 2 * progress);
      if (progress === 1) { morphing = false; returningLevels.fill(0); }
    }
    function render() {
      const waiting = visual.current.status === "connecting";
      svg.current?.setAttribute("data-voice-phase", waiting ? "connecting" : active() ? (visual.current.muted ? "muted" : "active") : "button");
      svg.current?.setAttribute("data-voice-morph", amount.toFixed(3));
      microphone.current?.setAttribute("opacity", (1 - amount).toFixed(3));
      microphone.current?.setAttribute("transform", `translate(300 90) scale(${(1 - amount * 0.25).toFixed(3)})`);
      // Material changes only during the finite transition, never on audio-only frames.
      if (amount !== paintedAmount) {
        colors.forEach((color, index) => color.resting.forEach((resting, stop) => {
          const value = amount === 0 ? resting : amount === 1 ? color.active[stop]
            : `color-mix(in srgb, ${resting} ${(1 - amount) * 100}%, ${color.active[stop]})`;
          stops.current[index * 3 + stop]?.setAttribute("stop-color", value);
        }));
        paintedAmount = amount;
      }
      const levels = !sessionOpen() && morphing ? returningLevels : signal.levels;
      for (let column = 0; column < count; column++) {
        const position = column / (count - 1) * (VOICE_BANDS - 1);
        const lower = Math.floor(position);
        const level = levels[lower] + (levels[Math.min(lower + 1, VOICE_BANDS - 1)] - levels[lower]) * (position - lower);
        // Three authored crests shape the composition; measured energy alone reveals them.
        const energy = Math.sqrt(level);
        const extent = energy * (0.35 + cells[column * 7].profile * 3.35);
        for (let row = 0; row < 7; row++) {
          const index = column * 7 + row;
          const node = nodes.current[index];
          if (!node) continue;
          const cell = cells[index];
          const visibility = level === 0 ? 0 : clamp((extent - Math.abs(row - 3) + 0.22) / 0.68, 0, 1);
          const opacity = Math.max(cell.rest ? (waiting ? 0.62 : 0.34) : 0, visibility * 0.98);
          const scale = (cell.rest && waiting ? 0.36 : 0.24) + visibility * (0.57 + energy * 0.19);
          const asymmetry = ((index * 7) % 9 - 4) / 4;
          const stretch = bend * 0.35 * level * asymmetry;
          node.setAttribute("opacity", (amount * opacity).toFixed(3));
          node.setAttribute("transform", `translate(${mix(300 + (cell.start.x - 300) * 0.14, cell.x).toFixed(3)} ${mix(90 + (cell.start.y - 90) * 0.14, cell.y).toFixed(3)}) rotate(${mix(cell.start.tilt, cell.tilt).toFixed(3)}) scale(${(mix(cell.start.width * 0.2, cell.width * scale * (1 + stretch)) / 2).toFixed(3)} ${(mix(cell.start.height * 0.2, cell.height * scale * (1 - stretch * 0.5)) / 2).toFixed(3)})`);
        }
      }
    }
    function tick(now: number) {
      frame = null;
      advanceMorph(now);
      const moving = signal.step(now);
      render();
      if (moving || morphing) frame = requestAnimationFrame(tick);
    }
    function schedule() { if (frame === null) frame = requestAnimationFrame(tick); }
    function reset() {
      cancel(); signal.reset(performance.now()); returningLevels.fill(0);
      morphing = false; amount = target; render();
    }
    paint.current = {
      draw(samples) {
        if (!samples) {
          signal.reset(performance.now());
          if (!morphing) cancel();
          render();
          if (morphing) schedule();
          return;
        }
        if (!active() || motion.matches || document.visibilityState === "hidden") return;
        // Extract features synchronously: onWaveform's four arrays are borrowed and reused.
        const measured = signal.receive(samples, performance.now(), visual.current.muted);
        if (frame === null && measured) frame = requestAnimationFrame(tick);
      },
      setState(state) {
        const now = performance.now();
        advanceMorph(now);
        const changedMute = visual.current.muted !== state.muted;
        visual.current = { status: state.status, muted: state.muted };
        const next = sessionOpen() ? 1 : 0;
        if (next !== target) {
          if (next === 0) returningLevels.set(signal.levels);
          from = amount; target = next; began = now;
          morphing = !motion.matches && document.visibilityState !== "hidden" && from !== target;
          if (!morphing) { amount = target; returningLevels.fill(0); }
        }
        if (!active() || changedMute) signal.reset(now);
        render();
        if (morphing) schedule();
        else if (!active()) cancel();
      },
    };
    const hidden = () => { if (document.visibilityState === "hidden") reset(); };
    reset();
    motion.addEventListener("change", reset);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", reset);
    return () => {
      cancel(); signal.reset();
      paint.current = { draw: noop, setState: noop };
      motion.removeEventListener("change", reset);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", reset);
    };
  }, [cells, colors, count, bend, sensitivity, silenceThreshold, attackMs, releaseMs]);

  return <svg data-voice-waveform data-voice-phase="button" data-voice-morph="0" ref={svg} viewBox={VOICE_VIEWBOX} width={600} height={180} aria-hidden="true" focusable="false" className="block h-32 w-full max-w-sm shrink-0">
    <defs>{colors.map((color, index) => <radialGradient key={index} id={`${id}-cell-${index}`} cx="28%" cy="22%" r="78%">
      {color.resting.map((value, stop) => <stop key={stop} ref={node => { stops.current[index * 3 + stop] = node; }} offset={["0", "0.58", "1"][stop]} stopColor={value} />)}
    </radialGradient>)}</defs>
    <g data-voice-microphone ref={microphone} opacity={1} transform="translate(300 90)">
      <path data-voice-mic-shape d="M -16 -30 C -16 -52 16 -52 16 -30 L 16 0 C 16 22 -16 22 -16 0 Z" fill="var(--navy)" />
      <path data-voice-mic-shape d="M -29 -3 L -29 2 C -29 40 29 40 29 2 L 29 -3 M 0 31 L 0 48 M -14 48 L 14 48" fill="none" stroke="var(--navy)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {cells.map((cell, index) => <g key={index} data-voice-cell data-voice-column={cell.column} data-voice-row={cell.row} data-voice-ivory={cell.ivory ? "true" : undefined} ref={node => { nodes.current[index] = node; }} opacity={0} transform={`translate(${(300 + (cell.start.x - 300) * 0.14).toFixed(3)} ${(90 + (cell.start.y - 90) * 0.14).toFixed(3)}) rotate(${cell.start.tilt.toFixed(3)}) scale(${(cell.start.width * 0.1).toFixed(3)} ${(cell.start.height * 0.1).toFixed(3)})`}>
      <path fill={`url(#${id}-cell-${index})`} d={cell.path} />
    </g>)}
  </svg>;
}
