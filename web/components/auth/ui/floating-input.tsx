"use client";

import { useId } from "react";
import { FieldError } from "./field-error";

export function FloatingInput({
  type = "text",
  label,
  autoComplete,
  dark,
  error,
  value,
  onChange,
}: {
  type?: string;
  label: string;
  autoComplete?: string;
  dark: boolean;
  error?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  const inputCls =
    "peer w-full px-4 pt-6 pb-2.5 text-base rounded-lg outline-none transition-colors duration-300 " +
    (dark
      ? "text-[#f0f0f0] bg-[#141414] border placeholder-transparent " +
        (error
          ? "border-[#ff6b6b] focus:border-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#ff6b6b]/20"
          : "border-[#2a2a2a] hover:border-[#3a3a3a] focus:border-[#2ec98d] focus-visible:ring-2 focus-visible:ring-[#2ec98d]/10")
      : "text-[#065F46] bg-white border placeholder-transparent " +
        (error
          ? "border-[#dc2626] focus:border-[#dc2626] focus-visible:ring-2 focus-visible:ring-[#dc2626]/10"
          : "border-[#b8d9d0] hover:border-[#8fb8ad] focus:border-[#15a37b] focus-visible:ring-2 focus-visible:ring-[#15a37b]/15"));

  const labelCls =
    "absolute left-4 pointer-events-none select-none transition-all duration-200 " +
    "text-[11px] font-medium top-[7px] " +
    "peer-placeholder-shown:text-base peer-placeholder-shown:font-normal peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 " +
    "peer-focus:text-[11px] peer-focus:font-medium peer-focus:top-[7px] peer-focus:translate-y-0 " +
    (error
      ? dark ? "text-[#ff9999]" : "text-[#dc2626]"
      : dark
      ? "text-[#5a7a6a] peer-placeholder-shown:text-[#666] peer-focus:text-[#2ec98d]"
      : "text-[#7aaa99] peer-placeholder-shown:text-[#aab5b2] peer-focus:text-[#15a37b]");

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={type}
          placeholder=" "
          autoComplete={autoComplete}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          aria-describedby={error ? errorId : undefined}
          className={inputCls}
        />
        <label htmlFor={id} className={labelCls}>
          {label}
        </label>
      </div>
      <FieldError msg={error} dark={dark} id={errorId} />
    </div>
  );
}
