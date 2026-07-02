import { useEffect } from "react";

export function useEscape(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    function h(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [active, onEscape]);
}
