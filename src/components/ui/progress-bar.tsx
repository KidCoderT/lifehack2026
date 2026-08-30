"use client";

import { motion } from "motion/react";
import { FILL, useCalm } from "@/components/fx/motion-config";

export function ProgressBar({
  value,
  max,
  className = "",
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  // Width is not a transform, so MotionConfig's reduced-motion handling does not cover it.
  const calm = useCalm();
  return (
    <div className={`h-3 overflow-hidden rounded-full bg-surface-muted ${className}`}>
      <motion.div
        className="flex h-full items-center justify-end rounded-full bg-primary pr-[3px]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={calm ? { duration: 0 } : FILL}
      >
        {/* The living edge. Never the length — the length encodes a real number. */}
        {pct > 0 && (
          <motion.span
            className="size-1.5 rounded-full bg-surface"
            animate={calm ? undefined : { scale: [1, 1.35, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}
