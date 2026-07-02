import { BookOpen, Home, Settings } from "lucide-react";
import { MOCK_PROJECTS } from "@/lib/mock-data";
import type { LucideIcon } from "lucide-react";
import type React from "react";

/* ── Animation constants ─────────────────────────────────────── */
export const SIDEBAR_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
export const SIDEBAR_DURATION = 380;
export const SEARCH_SLIDE_UP = 400;

/* ── Resize constraints ──────────────────────────────────────── */
export const SIDEBAR_DEFAULT_W   = 248;
export const SIDEBAR_MIN_W       = 180;
export const SIDEBAR_MAX_W       = 480;
export const SIDEBAR_COLLAPSED_W = 70;

/* ── Theme ───────────────────────────────────────────────────── */
export type Theme = "light" | "dark";

export function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.add("theme-transitioning");
  html.setAttribute("data-theme", t);
  localStorage.setItem("normai-theme", t);
  document.cookie = `normai-theme=${t};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  const id = setTimeout(() => html.classList.remove("theme-transitioning"), 520);
  return () => clearTimeout(id);
}

/* ── Text reveal animation style ────────────────────────────── */
/** Fades + slides text in after sidebar opens, exits fast. */
export function revealStyle(show: boolean): React.CSSProperties {
  return {
    opacity: show ? 1 : 0,
    maxWidth: show ? "200px" : "0",
    transform: show ? "translateX(0)" : "translateX(-6px)",
    transition: show
      ? `opacity 160ms ease ${SIDEBAR_DURATION * 0.35}ms, transform 220ms ${SIDEBAR_EASE} ${SIDEBAR_DURATION * 0.32}ms, max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`
      : `opacity 60ms ease, transform 60ms ease, max-width ${SIDEBAR_DURATION}ms ${SIDEBAR_EASE}`,
    pointerEvents: "none",
    overflow: "hidden",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

/* ── Static data ─────────────────────────────────────────────── */
export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/projects",   label: "Início",          icon: Home },
  { href: "/dictionary", label: "Dicionário Global", icon: BookOpen },
];

export const PROJECTS = MOCK_PROJECTS.map((p) => ({ id: p.id, title: p.title }));

export const USER = {
  name:     "Felipe Castro",
  email:    "felipe@normai.com",
  initials: "FC",
};

export const ACCOUNT_LINKS: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: Settings, label: "Gerenciar conta", href: "/account/settings" },
];
