"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LoginContent } from "./login-content";
import { PanelTagline } from "./panel-tagline";
import { RegisterContent } from "./register-content";
import type { Mode, Theme } from "./utils/auth-types";
import { useReducedMotion } from "./utils/use-reduced-motion";
import { useToast } from "@/components/ui/toast";
import dynamic from "next/dynamic";
import { useRef } from "react";

const Grainient = dynamic(() => import("@/components/blocks/Grainient"), {
  ssr: false,
});

// ── Color interpolation helpers ───────────────────────────────
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
      const e = 1 - Math.pow(1 - t, 3); // ease-out-cubic
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

export function AuthFormTest() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "register" ? "register" : "login",
  );
  const [logoVisible, setLogoVisible] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const { show: showToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("normai-theme") as Theme | null;
    if (saved === "dark") setTheme("dark");
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("normai-reset-success")) {
      sessionStorage.removeItem("normai-reset-success");
      showToast("Senha alterada com sucesso. Faça login para continuar.", {
        duration: 5000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reduced = useReducedMotion();

  const [panelItemsVisible, setPanelItemsVisible] = useState(true);

  const switchMode = useCallback(
    (next: Mode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "register") {
        params.set("mode", "register");
      } else {
        params.delete("mode");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

      if (reduced) {
        setMode(next);
        return;
      }
      setLogoVisible(false);
      setPanelItemsVisible(false);
      setTimeout(() => setMode(next), 160);
      setTimeout(() => {
        setLogoVisible(true);
        setPanelItemsVisible(true);
      }, 380);
    },
    [reduced, router, pathname, searchParams],
  );

  useEffect(() => {
    const saved = localStorage.getItem("normai-theme");
    if (saved)
      document.cookie = `normai-theme=${saved}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const dark = theme === "dark";

  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      localStorage.setItem("normai-theme", next);
      document.cookie = `normai-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--auth-page-bg",
      dark ? "#0a0a0a" : "#F0FDF9",
    );
  }, [dark]);

  const expo = "cubic-bezier(0.16, 1, 0.3, 1)";
  const grainAccent = useAnimatedColor(dark ? "#9dffa1" : "#15a37b", 500);
  const loginActive = mode === "login";
  // White form slides: login → left (0%), register → right (150% of 40% form = 60% of card)
  const formTranslate = loginActive ? "translateX(0%)" : "translateX(150%)";

  return (
    <div className="relative w-full min-h-screen md:min-h-0 md:h-[calc(100vh-2.5rem)] md:overflow-hidden md:rounded-2xl">
      {/* ── Background animation — full card, z-1 ─────────────── */}
      <div className="hidden md:block absolute inset-0 z-[1] pointer-events-none overflow-hidden rounded-2xl">
        <Grainient
          color1="#22569d"
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
          maxDpr={2}
          fps={60}
        />
      </div>

      {/* ── Overlay — logo, button, tagline on the animation ─────── */}
      <div
        className="hidden md:block absolute inset-0 z-10"
        style={{ pointerEvents: "none" }}
      >
        {/* Logo — snaps position during opacity fade */}
        <Image
          src="/whiteN.svg"
          alt="NormAI"
          width={50}
          height={50}
          className="absolute top-6"
          style={{
            left: loginActive ? "calc(100% - 80px)" : "24px",
            opacity: logoVisible ? 1 : 0,
            transition: reduced
              ? "none"
              : "opacity 200ms ease, filter 500ms ease",
            filter: dark ? "invert(1)" : "none",
          }}
        />
        {/* Tagline wrapper — slides with the open area so text centers within it */}
        <div
          className="absolute inset-0 w-[60%]"
          style={{
            transform: loginActive ? "translateX(66.667%)" : "translateX(0%)",
            transition: reduced ? "none" : `transform 800ms ${expo}`,
          }}
        >
          <PanelTagline dark={dark} />
        </div>
      </div>

      {/* ── Mobile: stacked forms ─────────────────────────────── */}
      <div className="md:hidden">
        {mode === "login" ? (
          <LoginContent
            onSwitch={() => switchMode("register")}
            dark={dark}
            onToggleTheme={toggleTheme}
          />
        ) : (
          <RegisterContent
              onRegistered={() => switchMode("login")}
            onSwitch={() => switchMode("login")}
            dark={dark}
            onToggleTheme={toggleTheme}
          />
        )}
      </div>

      {/* ── White sliding form — desktop only ────────────────── */}
      <div
        className="hidden md:flex md:flex-col md:justify-start md:overflow-y-auto absolute inset-y-0 z-20"
        style={{
          width: "calc(40% + 2px)",
          left: "-2px",
          top: "-2px",
          bottom: "-2px",
          background: dark ? "#0a0a0a" : "#F0FDF9",
          transform: formTranslate,
          transition: reduced
            ? "none"
            : `transform 800ms ${expo}, background-color 500ms ease`,
        }}
      >
        <div
          style={{
            opacity: panelItemsVisible ? 1 : 0,
            transition: reduced ? "none" : "opacity 200ms ease",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {mode === "login" ? (
            <LoginContent
              onSwitch={() => switchMode("register")}
              dark={dark}
              onToggleTheme={toggleTheme}
            />
          ) : (
            <RegisterContent
              onRegistered={() => switchMode("login")}
              onSwitch={() => switchMode("login")}
              dark={dark}
              onToggleTheme={toggleTheme}
            />
          )}
        </div>
      </div>
    </div>
  );
}
