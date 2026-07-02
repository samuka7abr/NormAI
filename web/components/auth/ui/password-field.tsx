"use client";

import { useId, useState } from "react";
import { FieldError } from "./field-error";

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function PasswordField({
  placeholder,
  autoComplete,
  dark,
  error,
  value,
  onChange,
  onBlur,
}: {
  placeholder: string;
  autoComplete: string;
  dark: boolean;
  error?: string;
  value?: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  const inputCls =
    "peer w-full px-4 pt-6 pb-2.5 pr-12 text-base rounded-lg outline-none transition-colors duration-300 " +
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
          type={visible ? "text" : "password"}
          placeholder=" "
          aria-label={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onBlur={onBlur}
          aria-describedby={error ? errorId : undefined}
          className={inputCls}
        />
        <label htmlFor={id} className={labelCls}>
          {placeholder}
        </label>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          className={
            "absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md cursor-pointer transition-colors duration-200 " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1 " +
            (dark
              ? "text-[#666] hover:text-[#aaa] hover:bg-white/[0.07]"
              : "text-[#888] hover:text-[#555] hover:bg-[#065F46]/[0.06]")
          }
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <FieldError msg={error} dark={dark} id={errorId} />
    </div>
  );
}
