"use client";

import { useReducedMotion } from "motion/react";

/**
 * Shared motion values. `motion/react` animates in JS, so the reduced-motion block in
 * `globals.css` (which only zeroes CSS durations) never reaches it. `fx/calm.tsx` wires
 * the root `MotionConfig`; `useCalm()` covers the cases MotionConfig cannot see —
 * imperative `animate()` and non-transform properties like a bar's width.
 */

/** Tap feedback, every button and button-shaped link. */
export const TAP = { scale: 0.97 } as const;

/** Section entrance (`motion/fade-in.tsx`). */
export const FADE = { duration: 0.3 } as const;

/** Anything that should feel physical: takeover content, particles. */
export const SPRING = { type: "spring", stiffness: 320, damping: 26 } as const;

/**
 * Progress fill. A tween, never a spring: an underdamped bar overshoots its true value
 * on the way to rest, and the length of that bar is a real number.
 */
export const FILL = { duration: 0.6, ease: "easeOut" } as const;

/** How long a celebration holds before it dismisses itself. */
export const HOLD_MS = 3200;

export function useCalm() {
  return useReducedMotion() ?? false;
}
