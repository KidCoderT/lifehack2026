"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

// Flat fills only — Field Notes has no gradients or opacity ramps in the art.
// Shadow side of the foliage is canopy-deep, lit side is canopy.
// All stages share viewBox 0 0 100 120 with the ground line at y=108.
const STAGE_ART: ReactNode[] = [
  // 0 — Seed
  <g key={0}>
    <ellipse cx={50} cy={104} rx={7} ry={9} className="fill-bark" />
    <path d="M50 96 v8" strokeWidth={1.5} className="stroke-bark" />
  </g>,
  // 1 — Sprout
  <g key={1}>
    <path d="M50 108 V88" strokeWidth={3} strokeLinecap="round" className="stroke-bark" />
    <ellipse cx={41} cy={86} rx={9} ry={5} className="fill-canopy" transform="rotate(-30 41 86)" />
    <ellipse cx={59} cy={86} rx={9} ry={5} className="fill-canopy-deep" transform="rotate(30 59 86)" />
  </g>,
  // 2 — Sapling
  <g key={2}>
    <path d="M50 108 V72" strokeWidth={4} strokeLinecap="round" className="stroke-bark" />
    <circle cx={50} cy={62} r={16} className="fill-canopy-deep" />
    <circle cx={50} cy={56} r={12} className="fill-canopy" />
  </g>,
  // 3 — Young Tree
  <g key={3}>
    <path d="M50 108 V58 M50 76 L38 66 M50 70 L62 62" strokeWidth={5} strokeLinecap="round" fill="none" className="stroke-bark" />
    <circle cx={36} cy={58} r={14} className="fill-canopy-deep" />
    <circle cx={64} cy={54} r={14} className="fill-canopy-deep" />
    <circle cx={50} cy={44} r={17} className="fill-canopy" />
  </g>,
  // 4 — Mature Tree
  <g key={4}>
    <path d="M50 108 V50 M50 74 L34 60 M50 66 L68 54" strokeWidth={7} strokeLinecap="round" fill="none" className="stroke-bark" />
    <circle cx={28} cy={54} r={15} className="fill-canopy-deep" />
    <circle cx={72} cy={50} r={15} className="fill-canopy-deep" />
    <circle cx={38} cy={38} r={16} className="fill-canopy-deep" />
    <circle cx={62} cy={36} r={16} className="fill-canopy" />
    <circle cx={50} cy={28} r={17} className="fill-canopy" />
  </g>,
  // 5 — Blossoming
  <g key={5}>
    <path d="M50 108 V50 M50 74 L34 60 M50 66 L68 54" strokeWidth={7} strokeLinecap="round" fill="none" className="stroke-bark" />
    <motion.g
      animate={{ rotate: [-1.2, 1.2, -1.2] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      style={{ transformOrigin: "50px 60px", transformBox: "view-box" }}
    >
      <circle cx={28} cy={54} r={15} className="fill-canopy-deep" />
      <circle cx={72} cy={50} r={15} className="fill-canopy-deep" />
      <circle cx={38} cy={38} r={16} className="fill-canopy-deep" />
      <circle cx={62} cy={36} r={16} className="fill-canopy" />
      <circle cx={50} cy={28} r={17} className="fill-canopy" />
      {[
        [32, 48], [46, 24], [60, 32], [72, 44], [40, 36], [54, 42], [66, 26], [26, 60],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} className="fill-surface" />
      ))}
    </motion.g>
  </g>,
];

const SIZES = { xs: "w-11", sm: "w-20", lg: "w-44" } as const;

export function Tree({
  stage,
  size = "sm",
  className = "",
}: {
  stage: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = Math.max(0, Math.min(stage, STAGE_ART.length - 1));
  return (
    <svg viewBox="0 0 100 120" className={`${SIZES[size]} ${className}`} role="img" aria-label={`Tree stage ${s}`}>
      <ellipse cx={50} cy={110} rx={30} ry={7} className="fill-plot" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.g
          key={s}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.35 }}
          style={{ transformOrigin: "50px 108px", transformBox: "view-box" }}
        >
          {STAGE_ART[s]}
        </motion.g>
      </AnimatePresence>
    </svg>
  );
}
