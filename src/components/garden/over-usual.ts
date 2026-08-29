/**
 * Copy for the over-baseline flag, in one place so the tile label, the inspector and
 * the header can't drift apart.
 *
 * The flag means "earned zero points on the latest reading day", which rounds in
 * anyone from roughly 0.5% *under* baseline upward — so a member can be flagged
 * without actually being over. Everything here branches on that; saying "using X%
 * more" unconditionally would be wrong for someone sitting exactly at their usual.
 */

/** Whole-percent overshoot, or null when flagged without being genuinely over. */
export function overPercent(pct: number | null): number | null {
  if (pct === null) return null;
  const n = Math.round(pct);
  return n > 0 ? n : null;
}

/** Sentence for the inspector card. `isMe` switches to second person. */
export function overSentence(pct: number | null, isMe: boolean): string {
  const n = overPercent(pct);
  const who = isMe ? "You're using" : "Using";
  if (n === null) {
    return isMe
      ? "You logged no savings against your usual today."
      : "No savings against their usual today.";
  }
  return `${who} ${n}% more power than usual today.`;
}

/** Short amber pill — the number, not a label. */
export function overPill(pct: number | null): string {
  const n = overPercent(pct);
  return n === null ? "no savings" : `+${n}% vs usual`;
}

/** Suffix appended to a plot's aria-label. Empty when the member is fine. */
export function overAria(flagged: boolean, pct: number | null): string {
  if (!flagged) return "";
  const n = overPercent(pct);
  return n === null ? ", no savings today" : `, using ${n}% more power than usual`;
}
