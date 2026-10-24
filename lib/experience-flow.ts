export const experienceSteps = ["mood", "video", "demo", "waitlist"] as const;
export type ExperienceStep = typeof experienceSteps[number];

export function adjacentExperienceStep(step: ExperienceStep, key: string): ExperienceStep | undefined {
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  return direction ? experienceSteps[experienceSteps.indexOf(step) + direction] : undefined;
}

export function bubbleLifetime(random: number): number {
  return 5000 + Math.min(1, Math.max(0, random)) * 2000;
}

export function advanceBubbleAge(age: number, elapsed: number, paused: boolean): number {
  return paused ? age : age + Math.max(0, Math.min(elapsed, 500));
}
