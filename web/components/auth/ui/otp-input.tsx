"use client";

import { useId, useRef } from "react";
import { FieldError } from "./field-error";

export function OtpInput({
  value,
  onChange,
  dark,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  dark: boolean;
  error?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const baseId = useId();
  // Tracks the current code synchronously so rapid keystrokes don't read stale prop
  const codeRef = useRef(value);
  codeRef.current = value;

  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function cellClass(d: string): string {
    const base =
      "w-11 h-14 text-center text-xl font-bold rounded-lg border outline-none transition-all duration-200 " +
      (dark ? "text-[#f0f0f0] bg-[#141414]" : "text-[#065F46] bg-white");
    if (error)
      return (
        base +
        (dark
          ? " border-[#ff6b6b] focus:border-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#ff6b6b]/20"
          : " border-[#dc2626] focus:border-[#dc2626] focus-visible:ring-2 focus-visible:ring-[#dc2626]/10")
      );
    if (d.trim())
      return (
        base +
        (dark ? " border-[#2ec98d]" : " border-[#15a37b]")
      );
    return (
      base +
      (dark
        ? " border-[#2a2a2a] focus:border-[#2ec98d] focus-visible:ring-2 focus-visible:ring-[#2ec98d]/10"
        : " border-[#b8d9d0] focus:border-[#15a37b] focus-visible:ring-2 focus-visible:ring-[#15a37b]/15")
    );
  }

  function handleChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const current = codeRef.current.padEnd(6, " ").slice(0, 6).split("");
    const d = current.map((x) => (x.trim() ? x : ""));
    d[idx] = char;
    const next = d.join("");
    codeRef.current = next;
    onChange(next);
    if (char && idx < 5) refs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!digits[idx].trim() && idx > 0) {
        const current = codeRef.current.padEnd(6, " ").slice(0, 6).split("");
        const d = current.map((x) => (x.trim() ? x : ""));
        d[idx - 1] = "";
        const next = d.join("");
        codeRef.current = next;
        onChange(next);
        refs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      codeRef.current = pasted;
      onChange(pasted);
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }

  return (
    <div className="text-center">
      <div className="flex justify-center gap-2.5" onPaste={handlePaste} aria-label="Código de verificação">
        {digits.map((d, i) => (
          <input
            key={i}
            id={`${baseId}-${i}`}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={d.trim()}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={`Dígito ${i + 1} de 6`}
            className={cellClass(d)}
          />
        ))}
      </div>
      {error && <FieldError msg={error} dark={dark} />}
    </div>
  );
}
