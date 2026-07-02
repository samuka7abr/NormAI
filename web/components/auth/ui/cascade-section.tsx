"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "../utils/use-reduced-motion";

/**
 * Wraps children with a slide-up + fade-in entrance animation.
 * When `prefers-reduced-motion` is active, content appears immediately.
 */
export function CascadeSection({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: reduced
          ? "none"
          : "opacity 220ms ease-out, transform 220ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
