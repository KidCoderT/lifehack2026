"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";

const MotionLink = motion.create(Link);

/**
 * A Link that taps like a Button. `ui/Button` renders a <button>, which cannot
 * legally sit inside an <a> — this is the navigation-shaped variant.
 */
export function CtaLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <MotionLink
      href={href}
      whileTap={{ scale: 0.97 }}
      className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-bold ${
        variant === "primary" ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"
      } ${className}`}
    >
      {children}
    </MotionLink>
  );
}
