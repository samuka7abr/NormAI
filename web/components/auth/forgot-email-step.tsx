"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/lib/auth";
import { FieldError } from "./ui/field-error";
import { FloatingInput } from "./ui/floating-input";
import { ThemeToggle } from "./ui/theme-toggle";
import { submitClass } from "./utils/auth-styles";
import { EMAIL_RE } from "./utils/auth-validation";

export function ForgotEmailStep({
  dark,
  onToggleTheme,
  onNext,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  onNext: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Informe seu e-mail."); return; }
    if (!EMAIL_RE.test(email)) { setError("E-mail inválido."); return; }
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email);
      onNext(email);
    } catch {
      setError("Erro ao enviar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const h1Class =
    "text-[40px] md:text-[64px] font-bold tracking-[-0.03em] leading-[1.15] mb-3 transition-colors duration-500 " +
    (dark ? "text-[#f5f5f5]" : "text-[#1b3630]");
  const subtitleClass =
    "text-sm mb-8 transition-colors duration-500 " +
    (dark ? "text-[#888]" : "text-[#666666]");

  return (
    <div className="relative px-6 pt-20 pb-12 md:px-16 md:pt-28">
      <ThemeToggle dark={dark} onToggle={onToggleTheme} side="right" />

      <Link
        href="/login"
        className={
          "absolute top-7 left-6 md:left-8 flex items-center gap-1.5 text-sm transition-colors duration-200 " +
          (dark ? "text-[#555] hover:text-[#888]" : "text-[#999] hover:text-[#555]")
        }
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Voltar ao login
      </Link>

      <h1 className={h1Class}>Esqueceu a senha?</h1>
      <p className={subtitleClass}>
        Informe seu e-mail e enviaremos um código de verificação.
      </p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <FloatingInput
          type="email"
          label="E-mail"
          autoComplete="email"
          dark={dark}
          error={error}
          value={email}
          onChange={(v) => { setEmail(v); setError(""); }}
        />

        <button type="submit" disabled={loading} className={submitClass(dark, loading)}>
          {loading ? "Enviando..." : "Enviar código"}
        </button>
      </form>
    </div>
  );
}
