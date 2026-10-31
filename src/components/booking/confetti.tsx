"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

export function Confetti() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 9) * 0.06,
        rot: (i * 47) % 360,
        color: ["#C6F36B", "#101820", "#93C72E", "#E7E9EE"][i % 4],
        dx: ((i % 7) - 3) * 18,
      })),
    [],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block h-2.5 w-1.5 rounded-sm"
          style={{ left: `${p.left}%`, background: p.color }}
          initial={{ y: -20, opacity: 1, rotate: p.rot }}
          animate={{ y: 700, x: p.dx, opacity: 0, rotate: p.rot + 360 }}
          transition={{ duration: 2.2, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
