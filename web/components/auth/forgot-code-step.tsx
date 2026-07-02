"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { authApi } from "@/lib/auth";
import { OtpInput } from "./ui/otp-input";
import { ThemeToggle } from "./ui/theme-toggle";
import { linkClass, submitClass } from "./utils/auth-styles";

export function ForgotCodeStep({
  dark,
  onToggleTheme,
  email,
  onBack,
  onNext,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  email: string;
  onBack: () => void;
  onNext: (resetToken: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) { setError("Insira o código completo de 6 dígitos."); return; }
    setLoading(true);
    setError("");
    try {
      const { token } = await authApi.verifyResetCode(email, code);
      onNext(token);
    } catch {
      setError("Código inválido ou expirado. Tente novamente.");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!canResend || resendLoading) return;
    setResendLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email);
      setCountdown(60);
      setCanResend(false);
      setCode("");
    } catch {
      setError("Erro ao reenviar. Tente novamente.");
    } finally {
      setResendLoading(false);
    }
  }

  const h1Class =
    "text-[40px] md:text-[64px] font-bold tracking-[-0.03em] leading-[1.15] mb-3 transition-colors duration-500 " +
    (dark ? "text-[#f5f5f5]" : "text-[#1b3630]");
  const subtitleClass =
    "text-sm mb-8 transition-colors duration-500 " +
    (dark ? "text-[#888]" : "text-[#666666]");
  const mutedClass =
    "transition-colors duration-500 " + (dark ? "text-[#555]" : "text-[#aaaaaa]");

  return (
    <div className="relative px-6 pt-20 pb-12 md:px-16 md:pt-28">
      <ThemeToggle dark={dark} onToggle={onToggleTheme} side="right" />

      <button
        type="button"
        onClick={onBack}
        className={
          "absolute top-7 left-6 md:left-8 flex items-center gap-1.5 text-sm transition-colors duration-200 " +
          (dark ? "text-[#555] hover:text-[#888]" : "text-[#999] hover:text-[#555]")
        }
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Voltar
      </button>

      <h1 className={h1Class}>Verifique seu e-mail</h1>
      <p className={subtitleClass}>
        Enviamos um código de 6 dígitos para{" "}
        <span
          className="font-medium"
          style={{ color: dark ? "#c2f0c2" : "#065F46" }}
        >
          {email}
        </span>
        .
      </p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <OtpInput
          value={code}
          onChange={(v) => { setCode(v); setError(""); }}
          dark={dark}
          error={error}
        />

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className={submitClass(dark, loading || code.length < 6)}
        >
          {loading ? "Verificando..." : "Verificar código"}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-sm">
          <span className={mutedClass}>Não recebeu?</span>
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className={linkClass(dark) + " text-sm"}
            >
              {resendLoading ? "Reenviando..." : "Reenviar código"}
            </button>
          ) : (
            <span className={"tabular-nums " + mutedClass}>
              Reenviar em {countdown}s
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
