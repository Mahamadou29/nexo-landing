"use client";

import { Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type { SafeVideo } from "@/lib/landing-api";
import { attachVideoAmbience } from "@/lib/video-ambience";
import { startIntroductionPlayback } from "@/lib/video-playback";

export function IntroductionVideo({ video, onEnded, locale }: { video: SafeVideo; onEnded: () => void; locale: "fr" | "en" }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const endedCallback = useRef(onEnded);
  const [ambientTarget, setAmbientTarget] = useState<Element | null>(null);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [ending, setEnding] = useState(false);
  const local = video.kind === "file" && !video.origin;
  const t = (fr: string, en: string) => locale === "fr" ? fr : en;

  const attachPlayer = useCallback((media: HTMLVideoElement | null) => {
    player.current = media;
    setAmbientTarget(media?.closest(".experience-shell") ?? null);
  }, []);
  useEffect(() => { endedCallback.current = onEnded; }, [onEnded]);
  useEffect(() => {
    if (!ending) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setTimeout(() => endedCallback.current(), motion.matches ? 0 : 700);
    return () => clearTimeout(timer);
  }, [ending]);
  useEffect(() => {
    const media = player.current;
    if (!media) return;
    let active = true;
    if (!media.getAttribute("src")) media.src = video.url;
    if (local) void startIntroductionPlayback(media, () => active).then(result => {
      if (!active) return;
      setBlocked(result === "blocked");
      setMuted(media.muted);
    });
    return () => { active = false; media.pause(); media.removeAttribute("src"); media.load(); };
  }, [video.url, local]);
  useEffect(() => {
    if (!local || !ambientTarget || !player.current || !canvas.current) return;
    return attachVideoAmbience(player.current, canvas.current);
  }, [local, ambientTarget]);
  useEffect(() => {
    if (video.kind === "file") return;
    const subscribe = () => {
      const data = video.kind === "vimeo" ? { method: "addEventListener", value: "ended" } : { event: "listening", id: "nexo-video", channel: "nexo" };
      frame.current?.contentWindow?.postMessage(JSON.stringify(data), video.origin);
      if (video.kind === "youtube") frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"], id: "nexo-video" }), video.origin);
    };
    function receive(event: MessageEvent) {
      if (event.origin !== video.origin || event.source !== frame.current?.contentWindow) return;
      let data: unknown = event.data;
      try { if (typeof data === "string") data = JSON.parse(data); } catch { return; }
      if (!data || typeof data !== "object" || !("event" in data)) return;
      if (data.event === "ready" || data.event === "onReady") subscribe();
      if ((video.kind === "vimeo" && data.event === "ended") || (video.kind === "youtube" && data.event === "onStateChange" && "info" in data && data.info === 0)) setEnding(true);
    }
    window.addEventListener("message", receive);
    let tries = 0;
    const interval = setInterval(() => { subscribe(); if (++tries >= 15) clearInterval(interval); }, 1000);
    return () => { window.removeEventListener("message", receive); clearInterval(interval); };
  }, [video.kind, video.origin]);

  return <>
    {local && ambientTarget && createPortal(<div data-video-atmosphere data-ending={ending} aria-hidden="true"><canvas ref={canvas} width={64} height={36} /><div /></div>, ambientTarget)}
    <div data-video-ui data-ending={ending} data-ready={ready || video.kind !== "file"} className="relative">
      {video.kind === "file" ? <>
        <video ref={attachPlayer} controls playsInline preload={local ? "auto" : "metadata"} src={video.url} onLoadedData={() => setReady(true)} onPlaying={() => setBlocked(false)} onVolumeChange={event => setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)} onEnded={() => setEnding(true)} onError={() => setFailed(true)} className="aspect-video w-full" aria-label={t("Vidéo de présentation Nexo", "Nexo introduction video")}><track kind="captions" /></video>
        {local && !failed && !ending && <Button type="button" data-video-sound variant="secondary" className="absolute top-3 right-3 min-h-11 rounded-full bg-ivory/95 px-4 text-navy" aria-label={muted ? t("Activer le son", "Turn sound on") : t("Couper le son", "Mute sound")} onClick={() => {
          const media = player.current;
          if (!media) return;
          media.muted = !muted;
          if (!media.muted && media.volume === 0) media.volume = 1;
          setMuted(media.muted);
        }}>{muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}{muted && t("Activer le son", "Turn sound on")}</Button>}
        {blocked && !failed && !ending && <Button type="button" className="absolute top-1/2 left-1/2 min-h-11 -translate-1/2 rounded-full px-5" onClick={() => { void player.current?.play().catch(() => setBlocked(true)); }}><Play aria-hidden="true" />{t("Lire la vidéo", "Play video")}</Button>}
      </> : <iframe ref={frame} src={video.url} title={t("Vidéo de présentation Nexo", "Nexo introduction video")} className="aspect-video w-full" sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" allow="fullscreen; picture-in-picture" allowFullScreen />}
      {failed && <p role="status" className="rounded-xl bg-background/95 p-5 text-sm text-navy">{t("Cette vidéo ne peut pas être lue. Tu peux passer à la démo.", "This video cannot be played. You can go to the demo.")}</p>}
    </div>
  </>;
}
