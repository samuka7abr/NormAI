"use client";

import { OtpInput } from "./ui/otp-input";
import { linkClass } from "./utils/auth-styles";

interface ForgotOtpSectionProps {
  email: string;
  code: string;
  error: string;
  dark: boolean;
  countdown: number;
  canResend: boolean;
  resendLoading: boolean;
  onCodeChange: (v: string) => void;
  onResend: () => void;
}

/**
 * OTP entry panel — shown after email is submitted.
 * Includes the 6-digit input and the resend countdown/button.
 */
export function ForgotOtpSection({
  email,
  code,
  error,
  dark,
  countdown,
  canResend,
  resendLoading,
  onCodeChange,
  onResend,
}: ForgotOtpSectionProps) {
  const muted = dark ? "#555555" : "#aaaaaa";
  const accentText = dark ? "#c2f0c2" : "#065F46";

  return (
    <div className="flex flex-col gap-3 pt-1">
      <p style={{ fontSize: "13px", color: muted, textAlign: "center" }}>
        Código enviado para{" "}
        <span style={{ color: accentText, fontWeight: 500 }}>{email}</span>
      </p>

      <OtpInput
        value={code}
        onChange={onCodeChange}
        dark={dark}
        error={error}
      />

      {/* Resend row */}
      <div className="flex items-center justify-center gap-1.5 text-sm pt-1">
        <span style={{ color: muted, transition: "color 500ms" }}>
          Não recebeu?
        </span>
        {canResend ? (
          <button
            type="button"
            onClick={onResend}
            disabled={resendLoading}
            className={linkClass(dark) + " text-sm"}
          >
            {resendLoading ? "Reenviando..." : "Reenviar agora"}
          </button>
        ) : (
          <span
            className="tabular-nums"
            style={{ color: muted, transition: "color 500ms" }}
          >
            Reenviar em {countdown}s
          </span>
        )}
      </div>
    </div>
  );
}
