type PlaybackMedia = Pick<HTMLVideoElement, "play" | "muted">;
export type PlaybackResult = "audible" | "muted" | "blocked" | "cancelled";

export async function startIntroductionPlayback(media: PlaybackMedia, isActive: () => boolean): Promise<PlaybackResult> {
  if (!isActive()) return "cancelled";
  media.muted = false;
  try {
    await media.play();
    return isActive() ? "audible" : "cancelled";
  } catch {
    if (!isActive()) return "cancelled";
    media.muted = true;
    try {
      await media.play();
      return isActive() ? "muted" : "cancelled";
    } catch {
      return isActive() ? "blocked" : "cancelled";
    }
  }
}
