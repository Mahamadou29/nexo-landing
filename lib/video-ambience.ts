export function attachVideoAmbience(video: HTMLVideoElement, canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return () => {};
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const hasVideoFrames = typeof video.requestVideoFrameCallback === "function";
  let frame: number | undefined;
  let lastPaint = -Infinity;
  let disposed = false;

  function paint(force = false) {
    if (disposed || document.hidden || video.readyState < 2) return;
    const now = performance.now();
    if (!force && now - lastPaint < 125) return;
    try {
      context!.globalAlpha = !force && canvas.dataset.ready === "true" ? 0.28 : 1;
      context!.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.dataset.ready = "true";
      lastPaint = now;
    } catch { /* A missing frame must never interrupt playback. */ }
  }
  function cancel() {
    if (frame === undefined) return;
    if (hasVideoFrames) video.cancelVideoFrameCallback(frame);
    else cancelAnimationFrame(frame);
    frame = undefined;
  }
  function schedule() {
    if (disposed || document.hidden || motion.matches || video.paused || video.ended || frame !== undefined) return;
    const next = () => { frame = undefined; paint(); schedule(); };
    frame = hasVideoFrames ? video.requestVideoFrameCallback(next) : requestAnimationFrame(next);
  }
  function refresh() { cancel(); paint(true); schedule(); }
  const events = ["loadeddata", "playing", "pause", "seeked", "ended"] as const;
  events.forEach(event => video.addEventListener(event, refresh));
  document.addEventListener("visibilitychange", refresh);
  motion.addEventListener("change", refresh);
  refresh();
  return () => {
    disposed = true;
    cancel();
    events.forEach(event => video.removeEventListener(event, refresh));
    document.removeEventListener("visibilitychange", refresh);
    motion.removeEventListener("change", refresh);
    context.clearRect(0, 0, canvas.width, canvas.height);
    delete canvas.dataset.ready;
  };
}
