/** Shared points/tree math — imported by seed, demo actions, and pages. */

/** Contributed points needed to reach each tree stage (index = stage). */
export const STAGES = [0, 50, 150, 400, 800, 1500];
export const STAGE_NAMES = ["Seed", "Sprout", "Sapling", "Young Tree", "Mature Tree", "Blossoming"];

export function treeStage(contributed: number): number {
  return STAGES.filter((t) => contributed >= t).length - 1;
}

/** 1% below baseline = 10 pts/day, floored at 0. */
export function earnFor(baseline: number, actual: number): number {
  return Math.max(0, Math.round((1 - actual / baseline) * 100)) * 10;
}

/**
 * "Today" is the newest seeded day, never the wall clock — the demo data ends
 * wherever /demo last advanced it, and timezones can't shift it.
 */
export function latestDay(days: { day: string }[]): string | undefined {
  return days.reduce<string | undefined>((max, r) => (!max || r.day > max ? r.day : max), undefined);
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
