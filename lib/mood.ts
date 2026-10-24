export type MoodTone = "gentle" | "bright" | "neutral";
// Deliberately modest keyword hints, not sentiment analysis or a diagnosis.
// Negations and mixed/unclear wording always receive neutral encouragement.
export function classifyMood(input: string): MoodTone {
  const text = input.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(pas|plus|jamais|non|ni|sans|not|no|never|neither|hardly|isn|don|doesn|can|won|wasn|aren|couldn|wouldn|shouldn)\b|n['’]/.test(text)) return "neutral";
  const gentle = /\b(triste|fatiguee?|stressee?|anxieu\w*|seul\w*|sad|tired|stress\w*|anxious|lonely|overwhelmed)\b/.test(text);
  const bright = /\b(heureu\w*|joyeu\w*|content\w*|bien|happy|great|joyful|calm|calme|good)\b/.test(text);
  return gentle === bright ? "neutral" : gentle ? "gentle" : "bright";
}
export const moodWords = {
  fr: { gentle: ["À ton rythme", "Tu peux faire une pause", "Un instant pour toi"], bright: ["Savoure cet instant", "De la place pour toi", "À ton rythme"], neutral: ["Tout peut se dire", "Sans pression", "Prends ton temps"] },
  en: { gentle: ["At your own pace", "You can take a pause", "A moment for you"], bright: ["Savour this moment", "Room for you", "At your own pace"], neutral: ["Room for every feeling", "No pressure", "Take your time"] },
};
