"use client";

import { motion } from "motion/react";
import type { ComponentProps } from "react";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-surface-muted text-foreground",
  ghost: "bg-transparent text-muted",
} as const;

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<typeof motion.button> & {
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`rounded-xl px-5 py-3.5 text-[15px] font-bold disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
