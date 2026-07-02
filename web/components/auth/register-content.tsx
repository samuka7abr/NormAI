"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FieldError } from "./ui/field-error";
import { FloatingInput } from "./ui/floating-input";
import { PasswordField } from "./ui/password-field";
import { PasswordStrength } from "./ui/password-strength";
import { SocialLogin } from "./ui/social-login";
import { ThemeToggle } from "./ui/theme-toggle";
import { linkClass, submitClass } from "./utils/auth-styles";
import type { RegisterContentProps } from "./utils/auth-types";
import { validateRegister, type RegisterErrors } from "./utils/auth-validation";

export function RegisterContent({ onSwitch, dark, onToggleTheme, onRegistered }: RegisterContentProps) {
  const { register, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [confirmBlurred, setConfirmBlurred] = useState(false);
  const [apiError, setApiError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function clearError(field: keyof RegisterErrors) {
    setErrors((v) => ({ ...v, [field]: undefined }));
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e = validateRegister({ firstName, lastName, email, password, confirmPassword });
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    setApiError("");
    try {
      await register(firstName, lastName, email, password);
      // O backend autentica no register; descartamos a sessão para que o
      // usuário confirme as credenciais na tela de login.
      await logout().catch(() => {});
      onRegistered({ email, password });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) setApiError("Este e-mail já está cadastrado.");
      else if (status === 422) setApiError("Verifique se o e-mail é válido e todos os campos estão preenchidos.");
      else setApiError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const h1Class =
    "text-[40px] md:text-[64px] font-bold tracking-[-0.03em] leading-[1.15] mb-3 transition-colors duration-500 " +
    (dark ? "text-[#f5f5f5]" : "text-[#1b3630]");
  const h1Style = { fontFamily: "var(--font-space-grotesk)" };
  const subtitleClass =
    "text-sm mb-8 transition-colors duration-500 " +
    (dark ? "text-[#888]" : "text-[#666666]");

  return (
    <div className="relative px-6 pt-16 pb-24 md:px-16 md:pt-28 md:pb-0">
      <ThemeToggle dark={dark} onToggle={onToggleTheme} side="right" />
      <div className="md:hidden absolute" style={{ top: "24px", right: "24px" }}>
        <Image
          src="/whiteN.svg"
          alt="NormAI"
          width={40}
          height={40}
          style={{ filter: dark ? "none" : "invert(1)" }}
        />
      </div>

      <Link
        href="/"
        className={`md:hidden flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors duration-300 ${dark ? "text-[#6a7a74] hover:text-[#aaa]" : "text-[#6a7a74] hover:text-[#047857]"}`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M9 2L4.5 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Início
      </Link>

      <h1 className={h1Class} style={h1Style}>Criar conta</h1>
      <p className={subtitleClass}>
        Já tem uma conta?{" "}
        <button type="button" onClick={onSwitch} className={linkClass(dark)}>
          Entrar
        </button>
      </p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FloatingInput
            label="Nome"
            autoComplete="given-name"
            dark={dark}
            error={errors.firstName}
            value={firstName}
            onChange={(v) => { setFirstName(v); clearError("firstName"); }}
          />
          <FloatingInput
            label="Sobrenome"
            autoComplete="family-name"
            dark={dark}
            error={errors.lastName}
            value={lastName}
            onChange={(v) => { setLastName(v); clearError("lastName"); }}
          />
        </div>

        <FloatingInput
          type="email"
          label="E-mail"
          autoComplete="email"
          dark={dark}
          error={errors.email}
          value={email}
          onChange={(v) => { setEmail(v); clearError("email"); }}
        />

        <div>
          <PasswordField
            placeholder="Senha"
            autoComplete="new-password"
            dark={dark}
            error={errors.password}
            value={password}
            onChange={(v) => { setPassword(v); clearError("password"); }}
          />
          <PasswordStrength password={password} dark={dark} />
        </div>
        <PasswordField
          placeholder="Confirmar senha"
          autoComplete="new-password"
          dark={dark}
          error={errors.confirmPassword || (confirmBlurred && confirmPassword.length > 0 && confirmPassword !== password ? "Não coincidem" : undefined)}
          value={confirmPassword}
          onChange={(v) => { setConfirmPassword(v); clearError("confirmPassword"); }}
          onBlur={() => setConfirmBlurred(true)}
        />

        {apiError && <FieldError msg={apiError} dark={dark} />}

        <button type="submit" disabled={loading} className={submitClass(dark, loading)}>
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <SocialLogin dark={dark} />
    </div>
  );
}
