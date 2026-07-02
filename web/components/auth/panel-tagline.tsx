"use client";

import { useEffect, useRef } from "react";
import { LOADER_TOTAL_MS } from "./loaders/logo-loader";

// Persists across client-side navigations — resets only on hard refresh.
// Ensures the redact animation runs exactly once per session.
let taglineRevealed = false;

function RedactWord({
  children,
  direction,
  delay,
  color,
  instant,
}: {
  children: string;
  direction: "left" | "right";
  delay: number;
  color: string;
  instant: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const finalTransform = direction === "left" ? "translateX(-110%)" : "translateX(110%)";

  useEffect(() => {
    if (instant) return;
    const el = ref.current;
    if (!el) return;
    const timer = setTimeout(() => {
      el.style.transform = finalTransform;
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, instant, finalTransform]);

  return (
    <span className="relative inline-block align-baseline overflow-hidden">
      {children}
      <span
        ref={ref}
        aria-hidden
        style={{
          position: "absolute",
          inset: "0 -2px",
          background: color,
          // When instant, start already at final position — no flash on remount
          transform: instant ? finalTransform : "translateX(0%)",
          transition: instant ? "none" : "transform 520ms cubic-bezier(0.76, 0, 0.24, 1)",
          willChange: "transform",
        }}
      />
    </span>
  );
}

export function PanelTagline({ dark }: { dark: boolean }) {
  const textColor = dark ? "#0d0d0d" : "#ffffff";
  const redactColor = dark ? "#0d0d0d" : "#ffffff";
  const instant = taglineRevealed;

  useEffect(() => {
    if (taglineRevealed) return;
    // Mark revealed after the last word finishes animating
    const timer = setTimeout(() => {
      taglineRevealed = true;
    }, LOADER_TOTAL_MS + 130 + 520);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="absolute bottom-[10%] left-10 right-0 px-12 select-none flex justify-center"
      style={{ fontFamily: "var(--font-archivo)", color: textColor, transition: "color 500ms ease" }}
    >
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.22em" }}>
          <RedactWord direction="left" delay={LOADER_TOTAL_MS} color={redactColor} instant={instant}>
            Padronize
          </RedactWord>
          <span>dados.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.22em" }}>
          <span>Potencialize</span>
          <RedactWord direction="right" delay={LOADER_TOTAL_MS + 130} color={redactColor} instant={instant}>
            decisões.
          </RedactWord>
        </div>
      </div>
    </div>
  );
}
