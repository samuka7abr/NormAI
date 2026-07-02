"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const GrainientBg = dynamic(
  () => import("@/components/blocks/Grainient"),
  { ssr: false },
);

// ── Color interpolation helpers (shared with auth-form) ──────────────────────
function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function useAnimatedColor(target: string, duration = 500): string {
  const [current, setCurrent] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === prevRef.current) return;
    const from = prevRef.current;
    prevRef.current = target;
    const fromRgb = hexToRgb(from);
    const toRgb = hexToRgb(target);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - t, 3);
      setCurrent(
        rgbToHex(
          Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * e),
          Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * e),
          Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * e),
        ),
      );
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return current;
}

// ── SVG paths from public/whiteN.svg (viewBox 0 0 240 240) ──────────────────
const PATH_L =
  "M63.8125 175.375C64.1458 173.083 64.3958 170.875 64.5625 168.75C64.7708 166.625 64.9167 164.542 65 162.5C65.125 160.417 65.1875 158.354 65.1875 156.312C65.2292 154.229 65.25 152.104 65.25 149.938V86.25C65.25 83.6667 65.25 81.0833 65.25 78.5C65.25 75.875 65.1875 73.4375 65.0625 71.1875C64.9792 68.9375 64.8333 66.9792 64.625 65.3125C64.4583 63.6042 64.1875 62.375 63.8125 61.625C64.5208 61.875 65.3542 62.0833 66.3125 62.25C67.2708 62.4167 68.2708 62.5417 69.3125 62.625C70.3542 62.7083 71.3958 62.7708 72.4375 62.8125C73.4792 62.8542 74.4375 62.875 75.3125 62.875C76.1875 62.875 77.125 62.8542 78.125 62.8125C79.1667 62.7708 80.2083 62.7083 81.25 62.625C82.2917 62.5417 83.2917 62.4167 84.25 62.25C85.2083 62.0833 86.0625 61.875 86.8125 61.625C86.4375 62.375 86.1458 63.6042 85.9375 65.3125C85.7708 66.9792 85.625 68.9375 85.5 71.1875C85.4167 73.4375 85.375 75.875 85.375 78.5C85.375 81.0833 85.375 83.6667 85.375 86.25V149.938C85.375 152.104 85.375 154.229 85.375 156.312C85.4167 158.354 85.4792 160.417 85.5625 162.5C85.6875 164.542 85.8333 166.625 86 168.75C86.2083 170.875 86.4792 173.083 86.8125 175.375C86.2292 175.208 85.4167 175.042 84.375 174.875C83.375 174.75 82.3125 174.625 81.1875 174.5C80.0625 174.375 78.9583 174.271 77.875 174.188C76.8333 174.146 75.9583 174.125 75.25 174.125C74.5417 174.125 73.6458 174.146 72.5625 174.188C71.5208 174.271 70.4375 174.375 69.3125 174.5C68.2292 174.625 67.1875 174.75 66.1875 174.875C65.1875 175.042 64.3958 175.208 63.8125 175.375Z";

const PATH_R =
  "M152.812 175.375C153.146 173.083 153.396 170.875 153.562 168.75C153.771 166.625 153.917 164.542 154 162.5C154.125 160.417 154.188 158.354 154.188 156.312C154.229 154.229 154.25 152.104 154.25 149.938V86.25C154.25 83.6667 154.25 81.0833 154.25 78.5C154.25 75.875 154.188 73.4375 154.062 71.1875C153.979 68.9375 153.833 66.9792 153.625 65.3125C153.458 63.6042 153.188 62.375 152.812 61.625C153.521 61.875 154.354 62.0833 155.312 62.25C156.271 62.4167 157.271 62.5417 158.312 62.625C159.354 62.7083 160.396 62.7708 161.438 62.8125C162.479 62.8542 163.438 62.875 164.312 62.875C165.188 62.875 166.125 62.8542 167.125 62.8125C168.167 62.7708 169.208 62.7083 170.25 62.625C171.292 62.5417 172.292 62.4167 173.25 62.25C174.208 62.0833 175.062 61.875 175.812 61.625C175.438 62.375 175.146 63.6042 174.938 65.3125C174.771 66.9792 174.625 68.9375 174.5 71.1875C174.417 73.4375 174.375 75.875 174.375 78.5C174.375 81.0833 174.375 83.6667 174.375 86.25V149.938C174.375 152.104 174.375 154.229 174.375 156.312C174.417 158.354 174.479 160.417 174.562 162.5C174.688 164.542 174.833 166.625 175 168.75C175.208 170.875 175.479 173.083 175.812 175.375C175.229 175.208 174.417 175.042 173.375 174.875C172.375 174.75 171.312 174.625 170.188 174.5C169.062 174.375 167.958 174.271 166.875 174.188C165.833 174.146 164.958 174.125 164.25 174.125C163.542 174.125 162.646 174.146 161.562 174.188C160.521 174.271 159.438 174.375 158.312 174.5C157.229 174.625 156.188 174.75 155.188 174.875C154.188 175.042 153.396 175.208 152.812 175.375Z";

const PATH_D =
  "M100.062 89.875C99.6458 88.5 99.1667 86.9792 98.625 85.3125C98.0833 83.6042 97.5 81.875 96.875 80.125C96.25 78.375 95.6042 76.6458 94.9375 74.9375C94.2708 73.1875 93.6042 71.6042 92.9375 70.1875C92.2708 68.7708 91.625 67.5625 91 66.5625C90.375 65.5208 89.7917 64.8125 89.25 64.4375C90.5 64.7708 92.1042 65.0625 94.0625 65.3125C96.0208 65.5625 98.4375 65.6875 101.312 65.6875C104.188 65.6875 106.625 65.5625 108.625 65.3125C110.625 65.0625 112.25 64.7708 113.5 64.4375C113.25 64.9375 113.125 65.7083 113.125 66.75C113.125 67.9167 113.271 69.3542 113.562 71.0625C113.854 72.7708 114.25 74.625 114.75 76.625C115.25 78.625 115.812 80.7083 116.438 82.875C117.062 85 117.688 87.0625 118.312 89.0625L137.688 149.938C138.104 151.312 138.583 152.854 139.125 154.562C139.667 156.229 140.25 157.938 140.875 159.688C141.5 161.438 142.146 163.188 142.812 164.938C143.479 166.646 144.146 168.208 144.812 169.625C145.479 171.042 146.125 172.25 146.75 173.25C147.375 174.292 147.958 175 148.5 175.375C147.708 175.125 146.792 174.917 145.75 174.75C144.75 174.583 143.708 174.458 142.625 174.375C141.542 174.292 140.458 174.229 139.375 174.188C138.292 174.146 137.292 174.125 136.375 174.125C135.458 174.125 134.438 174.146 133.312 174.188C132.229 174.229 131.146 174.292 130.062 174.375C128.979 174.458 127.917 174.583 126.875 174.75C125.875 174.917 125 175.125 124.25 175.375C124.5 174.875 124.625 174.125 124.625 173.125C124.625 171.958 124.458 170.5 124.125 168.75C123.833 167.042 123.438 165.208 122.938 163.25C122.479 161.25 121.938 159.188 121.312 157.062C120.688 154.896 120.062 152.792 119.438 150.75L100.062 89.875Z";

// ── Easings ──────────────────────────────────────────────────────────────────
// Slide: bouncy arrive (slight overshoot on landing)
const BOUNCE_LAND = "cubic-bezier(0.34, 1.1, 0.64, 1)";
// Rotation: smooth expo-out (slower and softer than slide)
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
// Phase 3 snap: ease-in punch (accelerate INTO the center)
// with a gentler overshoot so it doesn't feel too mechanical
const SNAP_BOUNCE = "cubic-bezier(0.34, 1.05, 0.64, 1)";
const SHIFT_AMOUNT = 55;
const TEXT = "ormAI";

// ── Timing (ms from mount) ────────────────────────────────────────────────────
// Phase 0 → 1: pipes depart corners, begin perimeter walk
// Phase 1 → 2: continue walk to center edges
// Phase 2 → 3: snap to natural N positions (Nintendo Switch)
// Phase 3 → 4: rotate each piece to its natural angle, N forms
const PHASE1 = 350; // brief initial settle
const PHASE2 = PHASE1 + 750;
const PHASE3 = PHASE2 + 750;
const PHASE4 = PHASE3 + 900;
const REVEAL_AT = PHASE4 + 330; // ormAI blur-in after N settles
const REVEAL_DUR = 380;
const HOLD_END = PHASE4 + 1330;
const FADE_MS = 350;

// Per-phase slide/rotate durations
// Slide is faster and punchier; rotation is smoother and trails slightly behind
const SLIDE_DUR_12 = 650;
const ROT_DUR_12 = 650;
const SLIDE_DUR_3 = 600;
const ROT_DUR_4 = 600;

// ── Corner spread: normalized to the shorter axis ─────────────────────────────
// Problem: the loader is wider than tall (16:9+). Computing h from the full
// width pushes the L pipe nearly to the left edge while the vertical spread is
// much smaller — the horizontal distance dominates and the pipes look "too far".
//
// Fix: cap h to rawV so both axes use the same distance from natural position.
// The pipes land in the corner QUADRANT at a visually balanced 45° diagonal
// from the N logo, independent of screen aspect ratio.
//
// CORNER_PAD = how far the pipe CENTER sits from the loader edge (px).
// At 130 px the full rotated pipe body (~115 px diagonal extent) stays visible.
const CORNER_PAD = 250;
function computeSpread() {
  if (typeof window === "undefined") return { h: 390, v: 170 };
  const loaderW = window.innerWidth - 40;
  const loaderH = window.innerHeight - 40;
  // Each axis is independent — the screen is a rectangle, not a square.
  // h tracks the actual width available; v tracks the actual height.
  // The pipes travel further horizontally on wide screens, matching the
  // real corner positions without being artificially constrained.
  const h = Math.max(Math.round((loaderW - 180) / 2 + 94 - CORNER_PAD), 140);
  const v = Math.max(
    Math.round((loaderH - 300) / 2 + 148 - CORNER_PAD) + 60,
    100,
  );
  return { h, v };
}

// ── Phase state tables ────────────────────────────────────────────────────────
// L pipe:  starts top-left → walks to bottom-left → center-bottom → snaps to N
// R pipe:  starts bottom-right → walks to top-right → center-top → snaps to N
// Diagonal: stays at center throughout, only rotates (always same Δ as pipes)

type P = 0 | 1 | 2 | 3 | 4;

// Rotation tables are fixed; translation tables are built at runtime from spread values.
//
// Phase 2 target: pipes horizontal (−90° from natural |) + diagonal inverted (/ not \).
// The diagonal reaches −90° in phase 1 and holds there through phases 2-3,
// giving the / orientation the user wants without an extra rotation step.
const L_ROT: Record<P, number> = { 0: -45, 1: -135, 2: -90, 3: -90, 4: -90 };
const R_ROT: Record<P, number> = { 0: -45, 1: -135, 2: -90, 3: -90, 4: -90 };
// D rotates twice only: start (phase 1: 0→−90°) and end (phase 3: −90→0°, during snap).
const D_ROT: Record<P, number> = { 0: 75, 1: 145, 2: 235, 3: 265, 4: 265 };

// In phase 2, pipes must sit on the vertical center axis of the SVG (x=150px).
const L_CENTER_NUDGE = 45;
const R_CENTER_NUDGE = -45;

function buildTranslates(h: number, v: number) {
  // Phase 3 (Z): X stays at the center-nudge value from phase 2 — only Y moves.
  // Phase 4 (N): individual elements are frozen at phase 3 positions.
  //   The container wrapper rotates 90° CW as a unit (magic-cube spin).
  const lTx: Record<P, number> = {
    0: h,
    1: h,
    2: L_CENTER_NUDGE,
    3: L_CENTER_NUDGE,
    4: L_CENTER_NUDGE,
  };
  const lTy: Record<P, number> = { 0: -v, 1: v, 2: v, 3: 50, 4: 50 };
  const rTx: Record<P, number> = {
    0: -h,
    1: -h,
    2: R_CENTER_NUDGE,
    3: R_CENTER_NUDGE,
    4: R_CENTER_NUDGE,
  };
  const rTy: Record<P, number> = { 0: v, 1: -v, 2: -v, 3: -47, 4: -47 };
  return { lTx, lTy, rTx, rTy };
}

export const LOADER_TOTAL_MS = HOLD_END + FADE_MS;

export function LogoLoader({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState<P>(0);
  const [fadePhase, setFadePhase] = useState<"active" | "out" | "done">(
    "active",
  );
  const [revealProgress, setRevealProgress] = useState(0);
  const [impacting, setImpacting] = useState(false);
  const [dark] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("normai-theme") === "dark",
  );

  // Compute corner spread once on mount (screen-size-aware)
  const { h: spreadH, v: spreadV } = computeSpread();
  const { lTx, lTy, rTx, rTy } = buildTranslates(spreadH, spreadV);

  const rafRef = useRef<number>(0);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), PHASE1);
    const t2 = setTimeout(() => setPhase(2), PHASE2);
    const t3 = setTimeout(() => {
      setPhase(3);
      // brief impact pulse when pipes snap into N positions
      setImpacting(true);
      setTimeout(() => setImpacting(false), 200);
    }, PHASE3);
    const t4 = setTimeout(() => setPhase(4), PHASE4);

    const tReveal = setTimeout(() => {
      const start = performance.now();
      const frame = (now: number) => {
        const p = Math.min((now - start) / REVEAL_DUR, 1);
        setRevealProgress(p);
        if (p < 1) rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
    }, REVEAL_AT);

    const toOut = setTimeout(() => setFadePhase("out"), HOLD_END);
    const toDone = setTimeout(() => {
      setFadePhase("done");
      onDone?.();
    }, HOLD_END + FADE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tReveal);
      clearTimeout(toOut);
      clearTimeout(toDone);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Color 1 animation (hook — must be before any early return) ──────────────
  const grainAccent = dark ? "#9dffa1" : "#15a37b";
  const color1Target = fadePhase === "active" ? grainAccent : "#22569d";
  const color1Animated = useAnimatedColor(color1Target, 700);

  if (fadePhase === "done") return null;

  // ── Transitions per phase ─────────────────────────────────────────────────
  // Outer <g>: handles translate. Inner <g>: handles rotate.
  // Keeping them separate lets each move at its own speed and curve.
  const slideTrans = (() => {
    if (phase === 1 || phase === 2)
      return `transform ${SLIDE_DUR_12}ms ${BOUNCE_LAND}`;
    if (phase === 3) return `transform ${SLIDE_DUR_3}ms ${SNAP_BOUNCE}`;
    if (phase === 4) return `transform ${ROT_DUR_4}ms ${EXPO_OUT}`;
    return "none"; // phase 0 (initial)
  })();

  const rotTrans = (() => {
    if (phase === 1 || phase === 2)
      return `transform ${ROT_DUR_12}ms ${EXPO_OUT}`;
    // Phase 3: diagonal rotates −90°→0° while pipes snap to N positions.
    // Pipes don't rotate here (L/R ROT unchanged), so the transition is harmless for them.
    if (phase === 3) return `transform 480ms ${EXPO_OUT}`;
    if (phase === 4) return `transform ${ROT_DUR_4}ms ${EXPO_OUT}`;
    return "none"; // phase 0 or phase 3 (no rotation change during snap)
  })();

  // ── Colors ────────────────────────────────────────────────────────────────
  const fill = dark ? "#0d1f1a" : "white";
  const textColor = dark ? "#0d1f1a" : "#f0fdf9";
  const accentColor = dark ? "#0d8a5a" : "#C2F0C2";

  const revealEased = 1 - Math.pow(1 - revealProgress, 3);
  const blurPx = 12 * (1 - revealEased);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: "20px",
        borderRadius: "1rem",
        zIndex: 9999,
        background: grainAccent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        opacity: fadePhase === "out" ? 0 : 1,
        transition:
          fadePhase === "out"
            ? `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 1, 1)`
            : "none",
        pointerEvents: fadePhase === "out" ? "none" : "auto",
      }}
    >
      {/* Camada 0: Grainient de fundo */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <GrainientBg
          color1={color1Animated}
          color2={grainAccent}
          color3={grainAccent}
          timeSpeed={0.7}
          colorBalance={0}
          warpStrength={1}
          warpFrequency={5}
          warpSpeed={2}
          warpAmplitude={50}
          blendAngle={0}
          blendSoftness={0.05}
          rotationAmount={500}
          noiseScale={2}
          grainAmount={0.05}
          grainScale={0.5}
          grainAnimated={false}
          contrast={1.5}
          gamma={1}
          saturation={1}
          centerX={0.5}
          centerY={0.1}
          zoom={0.5}
          maxDpr={1}
          fps={30}
        />
      </div>

      {/* Camada 1: conteúdo SVG */}
      <div style={{ position: "relative", zIndex: 1 }}>
      {/* Impact pulse wrapper */}
      <div
        style={{
          transform: impacting ? "scale(1.025)" : "scale(1)",
          transition: impacting ? "none" : `transform 220ms ${EXPO_OUT}`,
        }}
      >
        {/* N + ormAI container — shifts left when text reveals */}
        <div
          style={{
            position: "relative",
            width: 300,
            height: 300,
            transform: `translateX(${revealProgress > 0 ? -SHIFT_AMOUNT : 0}px)`,
            transition:
              revealProgress > 0 ? `transform 300ms ${EXPO_OUT}` : "none",
          }}
        >
          <svg
            width={300}
            height={300}
            viewBox="0 0 240 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {/* ── Container: rotates as a unit in phase 4 (magic-cube spin) ── */}
            {/* Individual elements don't rotate; the group does a 90° CW turn.  */}
            {/* transformBox: view-box → origin anchored at SVG viewBox center (120,120). */}
            <g
              style={{
                transform: `rotate(${phase === 4 ? 90 : 0}deg)`,
                transformBox: "view-box",
                transformOrigin: "center",
                transition:
                  phase === 4
                    ? `transform ${ROT_DUR_4}ms ${EXPO_OUT}`
                    : "none",
                willChange: "transform",
              }}
            >
              {/* ── L pipe ── top-left → bottom-left → center-bottom → natural */}
              <g
                style={{
                  transform: `translate(${lTx[phase]}px, ${lTy[phase]}px)`,
                  transition: slideTrans,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  willChange: "transform",
                }}
              >
                <g
                  style={{
                    transform: `rotate(${L_ROT[phase]}deg)`,
                    transition: rotTrans,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    willChange: "transform",
                  }}
                >
                  <path d={PATH_L} fill={fill} />
                </g>
              </g>

              {/* ── Diagonal ── stays centered, rotates with the pipes */}
              <g
                style={{
                  transform: `rotate(${D_ROT[phase]}deg)`,
                  transition: rotTrans,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              >
                <path d={PATH_D} fill={fill} />
              </g>

              {/* ── R pipe ── bottom-right → top-right → center-top → natural */}
              <g
                style={{
                  transform: `translate(${rTx[phase]}px, ${rTy[phase]}px)`,
                  transition: slideTrans,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  willChange: "transform",
                }}
              >
                <g
                  style={{
                    transform: `rotate(${R_ROT[phase]}deg)`,
                    transition: rotTrans,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    willChange: "transform",
                  }}
                >
                  <path d={PATH_R} fill={fill} />
                </g>
              </g>
            </g>
          </svg>

          {/* ormAI — blur-in after N settles */}
          <span
            style={{
              position: "absolute",
              left: "100%",
              bottom: 72,
              marginLeft: -72,
              fontFamily: "var(--font-archivo)",
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: "0.01em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              opacity: revealProgress > 0 ? revealEased : 0,
              filter: `blur(${blurPx.toFixed(1)}px)`,
            }}
          >
            <span style={{ color: textColor }}>{TEXT.slice(0, 3)}</span>
            <span style={{ color: accentColor }}>{TEXT.slice(3)}</span>
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
