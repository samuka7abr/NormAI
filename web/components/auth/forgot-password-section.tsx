"use client";

import { CheckCircle2 } from "lucide-react";
import { FieldError } from "./ui/field-error";
import { PasswordField } from "./ui/password-field";
import { PasswordStrength } from "./ui/password-strength";

interface ForgotPasswordSectionProps {
  dark: boolean;
  password: string;
  confirmPassword: string;
  errors: { password?: string; confirm?: string };
  apiError: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
}

/**
 * New-password entry panel — cascades in after OTP is verified.
 * Reuses PasswordField + PasswordStrength from register.
 */
export function ForgotPasswordSection({
  dark,
  password,
  confirmPassword,
  errors,
  apiError,
  onPasswordChange,
  onConfirmChange,
}: ForgotPasswordSectionProps) {
  return (
    <>
      {/* Verified badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "9px 14px",
          borderRadius: "8px",
          border: `1px solid ${dark ? "#1e3d2e" : "#bbddd4"}`,
          background: dark ? "#0d2318" : "#f0fdf9",
          marginBottom: "4px",
        }}
      >
        <CheckCircle2
          size={14}
          style={{ color: dark ? "#2ec98d" : "#15a37b", flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: "13px",
            color: dark ? "#2ec98d" : "#15a37b",
            fontWeight: 500,
          }}
        >
          Código verificado
        </span>
      </div>

      {/* Divider + heading */}
      <div
        style={{
          height: "1px",
          background: dark ? "#222" : "#dceae6",
        }}
      />

      <p
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: dark ? "#e8e8e8" : "#1b3630",
        }}
      >
        Nova senha
      </p>

      {/* Password fields */}
      <div>
        <PasswordField
          placeholder="Nova senha"
          autoComplete="new-password"
          dark={dark}
          error={errors.password}
          value={password}
          onChange={onPasswordChange}
        />
        <PasswordStrength password={password} dark={dark} />
      </div>

      <PasswordField
        placeholder="Confirmar nova senha"
        autoComplete="new-password"
        dark={dark}
        error={errors.confirm}
        value={confirmPassword}
        onChange={onConfirmChange}
      />

      {apiError && <FieldError msg={apiError} dark={dark} />}
    </>
  );
}
