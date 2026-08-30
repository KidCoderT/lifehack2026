"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Honours `prefers-reduced-motion` for every `motion/react` animation in the app —
 * transform and layout animations are dropped, opacity is kept. Wraps the root layout
 * so components outside this file need no per-component opt-in.
 */
export function Calm({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
