"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/auth";
import { FieldError } from "./ui/field-error";
import { PasswordField } from "./ui/password-field";
import { PasswordStrength } from "./ui/password-strength";
import { ThemeToggle } from "./ui/theme-toggle";
import { submitClass } from "./utils/auth-styles";

export function ForgotResetStep({
  dark,
  onToggleTheme,
  resetToken,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  resetToken: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: { password?: string; confirm?: string } = {};
    if (!password) errs.password = "Crie uma senha.";
    else if (password.length < 8) errs.password = "Mínimo de 8 caracteres.";
    if (!confirmPassword) errs.confirm = "Confirme sua senha.";
    else if (confirmPassword !== password) errs.confirm = "As senhas não coincidem.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setApiError("");
    try {
      await authApi.resetPassword(resetToken, password);
      router.push("/login?reset=success");
    } catch {
      setApiError("Erro ao redefinir a senha. Tente novamente.");
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

      <h1 className={h1Class}>Nova senha</h1>
      <p className={subtitleClass}>Escolha uma senha segura para sua conta.</p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div>
          <PasswordField
            placeholder="Nova senha"
            autoComplete="new-password"
            dark={dark}
            error={errors.password}
            value={password}
            onChange={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: undefined })); }}
          />
          <PasswordStrength password={password} dark={dark} />
        </div>

        <PasswordField
          placeholder="Confirmar nova senha"
          autoComplete="new-password"
          dark={dark}
          error={errors.confirm}
          value={confirmPassword}
          onChange={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirm: undefined })); }}
        />

        {apiError && <FieldError msg={apiError} dark={dark} />}

        <button type="submit" disabled={loading} className={submitClass(dark, loading)}>
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </button>
      </form>
    </div>
  );
}
