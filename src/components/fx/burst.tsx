"use client";

import { motion } from "motion/react";

// ponytail: fixed angles, no rng — the rehearsal and the pitch render identically, and
// there is no hydration seed to worry about. Bump COUNT if it reads thin on stage.
const COUNT = 12;
const LEAVES = Array.from({ length: COUNT }, (_, i) => {
  const a = (i / COUNT) * Math.PI * 2;
  return {
    x: Math.cos(a) * 130,
    y: Math.sin(a) * 130 - 16,
    rotate: i * 47,
    // `canopy-deep` is #2f5a38 against `panel` #2a3328 — invisible. `plot` is the other
    // growth token and reads on the dark surface.
    light: i % 2 === 0,
  };
});

/** Flat leaf particles. Transform only — no gradients, no shadows, no opacity ramp. */
export function Burst() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {LEAVES.map((l, i) => (
        <motion.span
          key={i}
          className={`absolute size-3 rounded-tl-full rounded-br-full ${
            l.light ? "bg-plot" : "bg-canopy"
          }`}
          initial={{ x: 0, y: 0, scale: 0 }}
          animate={{ x: l.x, y: l.y, rotate: l.rotate, scale: [0, 1, 1, 0] }}
          transition={{ duration: 1.2, delay: 0.5 + (i % 4) * 0.05, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
