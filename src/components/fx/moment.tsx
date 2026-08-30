"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Burst } from "./burst";
import { HOLD_MS, SPRING } from "./motion-config";

/**
 * The one dark takeover: enter -> hold -> tap anywhere (or Skip, or Escape) -> exit.
 * `panel` is a legitimate dark surface in DESIGN.md; this is its named celebration use.
 * The enter is delayed so the bar and the count-up underneath are seen first — the
 * anticipation beat — and it never holds input longer than the skip label takes to read.
 */
export function Moment({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  // Ref'd so a re-render mid-hold (the transition settling) cannot restart the timer.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => close.current(), HOLD_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Portalled to <body>: this renders inside a Card inside a FadeIn motion.div, and any
  // ancestor holding a transform becomes the containing block for position: fixed.
  // Closed, this portal renders nothing, so SSR (null) and the first client paint match.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Goal reached"
          onClick={onClose}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 overflow-hidden bg-panel px-8 text-center text-panel-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.35, delay: 0.45 }}
        >
          <Burst />
          <motion.div
            className="relative flex flex-col items-center gap-2"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ ...SPRING, delay: 0.55 }}
          >
            {children}
          </motion.div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="relative mt-6 rounded-xl px-4 py-2 text-[11.5px] font-medium tracking-[0.11em] uppercase"
          >
            Tap anywhere to skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
