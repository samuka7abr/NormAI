"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle({
  dark,
  onToggle,
  side,
}: {
  dark: boolean;
  onToggle: () => void;
  side: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className={
        "absolute top-6 p-3 rounded-lg transition-colors duration-500 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center " +
        (side === "left" ? "left-8" : "right-8") +
        (dark
          ? " text-[#888] hover:text-[#f0f0f0] hover:bg-white/10"
          : " text-[#999] hover:text-[#065F46] hover:bg-[#065F46]/6")
      }
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
