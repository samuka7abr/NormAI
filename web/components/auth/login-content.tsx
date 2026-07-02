"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CustomCheckbox } from "./ui/custom-checkbox";
import { FieldError } from "./ui/field-error";
import { FloatingInput } from "./ui/floating-input";
import { PasswordField } from "./ui/password-field";
import { SocialLoginStacked } from "./ui/social-login-stacked";
import { ThemeToggle } from "./ui/theme-toggle";
import { linkClass, submitClass } from "./utils/auth-styles";
import type { LoginContentProps } from "./utils/auth-types";
import { validateLogin, type LoginErrors } from "./utils/auth-validation";

export function LoginContent({ onSwitch, dark, onToggleTheme, prefill }: LoginContentProps) {
  const router = useRouter();
  const { login } = useAuth();
  const rememberId = useId();
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [apiError, setApiError] = useState("");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [password, setPassword] = useState(prefill?.password ?? "");

  useEffect(() => {
    if (prefill) return;
    const saved = localStorage.getItem("normai_remembered_email");
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, [prefill]);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const e = validateLogin(email, password);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    setApiError("");
    try {
      await login(email, password);
      if (remember) {
        localStorage.setItem("normai_remembered_email", email);
      } else {
        localStorage.removeItem("normai_remembered_email");
      }
      router.push("/projects");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) setApiError("E-mail ou senha incorretos.");
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
    "text-sm mb-10 transition-colors duration-500 " +
    (dark ? "text-[#888]" : "text-[#666666]");

  return (
    <div className="relative px-6 pt-16 pb-24 md:px-16 md:pt-28 md:pb-0">
      <ThemeToggle dark={dark} onToggle={onToggleTheme} side="left" />
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

      <h1 className={h1Class} style={h1Style}>Bem-vindo de volta!</h1>
      <p className={subtitleClass}>
        Não tem uma conta?{" "}
        <button type="button" onClick={onSwitch} className={linkClass(dark)}>
          Cadastre-se
        </button>
      </p>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <FloatingInput
          type="email"
          label="E-mail"
          autoComplete="email"
          dark={dark}
          error={errors.email}
          value={email}
          onChange={(v) => {
            setEmail(v);
            setErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />

        <PasswordField
          placeholder="Senha"
          autoComplete="current-password"
          dark={dark}
          error={errors.password}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErrors((e) => ({ ...e, password: undefined }));
          }}
        />

        <div className="flex items-center justify-between">
          <CustomCheckbox
            id={rememberId}
            checked={remember}
            onChange={setRemember}
            label="Lembrar de mim"
            dark={dark}
          />
          <Link href="/forgot-password" className={`text-sm ${linkClass(dark)}`}>
            Esqueceu a senha?
          </Link>
        </div>

        {apiError && <FieldError msg={apiError} dark={dark} />}

        <button type="submit" disabled={loading} className={submitClass(dark, loading)}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <SocialLoginStacked dark={dark} />
    </div>
  );
}
