"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import { useCalm } from "./motion-config";

/**
 * Tweens a number when it *changes*. The first render paints the final value, so SSR
 * output is correct and there is no flash of 0 — the count fires on the server data
 * landing after a contribution, which is the only moment worth animating.
 *
 * `StatCard.value` is typed `string` and its callers pass pre-formatted text; this is
 * for the raw-number heroes instead.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const calm = useCalm();

  useEffect(() => {
    const el = ref.current;
    const from = prev.current;
    prev.current = value;
    // Imperative animate() sits outside MotionConfig, so reduced motion is checked here.
    if (!el || calm || from === value) return;
    const run = animate(from, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString();
      },
    });
    return () => run.stop();
  }, [value, calm]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
    </span>
  );
}
