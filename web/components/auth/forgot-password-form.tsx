"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authApi } from "@/lib/auth";
import { FloatingInput } from "./ui/floating-input";
import { ThemeToggle } from "./ui/theme-toggle";
import { EmailChip } from "./ui/email-chip";
import { CascadeSection } from "./ui/cascade-section";
import { ForgotOtpSection } from "./forgot-otp-section";
import { ForgotPasswordSection } from "./forgot-password-section";
import { PanelTagline } from "./panel-tagline";
import { submitClass } from "./utils/auth-styles";
import { EMAIL_RE } from "./utils/auth-validation";
import type { Theme } from "./utils/auth-types";
import dynamic from "next/dynamic";

const Grainient = dynamic(() => import("@/components/blocks/Grainient"), {
  ssr: false,
});

// ── Color interpolation helpers ───────────────────────────────
function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function useAnimatedColor(target: string, duration = 500): string {
  const [current, setCurrent] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === prevRef.current) return;
    const from = prevRef.current;
    prevRef.current = target;
    const fromRgb = hexToRgb(from);
    const toRgb = hexToRgb(target);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - t, 3);
      setCurrent(
        rgbToHex(
          Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * e),
          Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * e),
          Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * e),
        ),
      );
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return current;
}

type Stage = "email" | "code" | "password";

export function ForgotPasswordForm() {
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>("light");
  const [stage, setStage] = useState<Stage>("email");

  // Email stage
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Code stage
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [countdown, setCountdown] = useState(10); // initial: 10s; after resend: 60s
  const [resendLoading, setResendLoading] = useState(false);
  const canResend = countdown <= 0;
  const autoVerifyRef = useRef(false); // prevents double-calls on 6-digit auto-verify

  // Password stage
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<{ password?: string; confirm?: string }>({});
  const [apiError, setApiError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // ── Theme init ────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem("normai-theme") as Theme | null;
    if (saved === "dark") setTheme("dark");
    if (saved)
      document.cookie = `normai-theme=${saved}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const dark = theme === "dark";

  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      localStorage.setItem("normai-theme", next);
      document.cookie = `normai-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--auth-page-bg",
      dark ? "#0a0a0a" : "#F0FDF9",
    );
  }, [dark]);

  const grainAccent = useAnimatedColor(dark ? "#9dffa1" : "#15a37b", 500);

  // ── Countdown (runs only in code stage) ──────────────────────────

  useEffect(() => {
    if (stage !== "code" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, stage]);

  // ── Auto-verify on 6th digit ──────────────────────────────────────

  useEffect(() => {
    if (stage !== "code" || code.length !== 6 || autoVerifyRef.current) return;
    autoVerifyRef.current = true;
    runVerify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stage]);

  // ── API calls ─────────────────────────────────────────────────────

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setEmailError("Informe seu e-mail."); return; }
    if (!EMAIL_RE.test(email)) { setEmailError("E-mail inválido."); return; }
    setEmailLoading(true);
    setEmailError("");
    try {
      await authApi.forgotPassword(email);
      setStage("code");
      setCountdown(10);
      autoVerifyRef.current = false;
    } catch {
      setEmailError("Erro ao enviar o código. Tente novamente.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function runVerify(codeToVerify: string) {
    setVerifying(true);
    setCodeError("");
    try {
      const { token } = await authApi.verifyResetCode(email, codeToVerify);
      setResetToken(token);
      setStage("password");
    } catch {
      setCodeError("Código inválido ou expirado.");
      setCode("");
      autoVerifyRef.current = false;
    } finally {
      setVerifying(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) { setCodeError("Insira o código de 6 dígitos."); return; }
    if (verifying || autoVerifyRef.current) return;
    autoVerifyRef.current = true;
    await runVerify(code);
  }

  async function resendCode() {
    if (!canResend || resendLoading) return;
    setResendLoading(true);
    setCodeError("");
    try {
      await authApi.forgotPassword(email);
      setCountdown(60);
      setCode("");
      autoVerifyRef.current = false;
    } catch {
      setCodeError("Erro ao reenviar. Tente novamente.");
    } finally {
      setResendLoading(false);
    }
  }

  async function confirmNewPassword(e: React.FormEvent) {
    e.preventDefault();
    const errs: { password?: string; confirm?: string } = {};
    if (!password) errs.password = "Crie uma senha.";
    else if (password.length < 8) errs.password = "Mínimo de 8 caracteres.";
    if (!confirmPassword) errs.confirm = "Confirme sua senha.";
    else if (confirmPassword !== password) errs.confirm = "As senhas não coincidem.";
    setPwErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPwLoading(true);
    setApiError("");
    try {
      await authApi.resetPassword(resetToken, password);
      sessionStorage.setItem("normai-reset-success", "1");
      router.push("/login");
    } catch {
      setApiError("Erro ao redefinir a senha. Tente novamente.");
    } finally {
      setPwLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    if (stage === "email") return sendCode(e);
    if (stage === "code") return verifyCode(e);
    return confirmNewPassword(e);
  }

  function resetToEmail() {
    setStage("email");
    setCode("");
    setCodeError("");
    setCountdown(10);
    autoVerifyRef.current = false;
  }

  // ── Derived button state ──────────────────────────────────────────

  const buttonLabel =
    stage === "email"
      ? emailLoading ? "Enviando..." : "Enviar código"
      : stage === "code"
      ? verifying ? "Verificando..." : "Verificar código"
      : pwLoading ? "Confirmando..." : "Confirmar nova senha";

  const buttonDisabled =
    stage === "email" ? emailLoading
    : stage === "code" ? verifying
    : pwLoading;

  // ── Form content (shared between mobile and desktop) ─────────────

  const formContent = (
    <div className="relative px-6 pt-20 pb-12 md:px-16 md:pt-28">
      <ThemeToggle dark={dark} onToggle={toggleTheme} side="right" />

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

      <h1
        className={
          "text-[40px] md:text-[64px] font-bold tracking-[-0.03em] leading-[1.15] mb-3 transition-colors duration-500 " +
          (dark ? "text-[#f5f5f5]" : "text-[#1b3630]")
        }
      >
        Esqueceu a senha?
      </h1>
      <p
        className={
          "text-sm mb-8 transition-colors duration-500 " +
          (dark ? "text-[#888]" : "text-[#666666]")
        }
      >
        Informe seu e-mail e enviaremos um código de verificação.
      </p>

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
        noValidate
      >
        {stage === "email" ? (
          <FloatingInput
            type="email"
            label="E-mail"
            autoComplete="email"
            dark={dark}
            error={emailError}
            value={email}
            onChange={(v) => { setEmail(v); setEmailError(""); }}
          />
        ) : (
          <EmailChip email={email} dark={dark} onAlterar={resetToEmail} />
        )}

        {stage === "code" && (
          <CascadeSection>
            <ForgotOtpSection
              email={email}
              code={code}
              error={codeError}
              dark={dark}
              countdown={countdown}
              canResend={canResend}
              resendLoading={resendLoading}
              onCodeChange={(v) => {
                setCode(v);
                setCodeError("");
                autoVerifyRef.current = false;
              }}
              onResend={resendCode}
            />
          </CascadeSection>
        )}

        {stage === "password" && (
          <CascadeSection>
            <div className="flex flex-col gap-4">
              <ForgotPasswordSection
                dark={dark}
                password={password}
                confirmPassword={confirmPassword}
                errors={pwErrors}
                apiError={apiError}
                onPasswordChange={(v) => {
                  setPassword(v);
                  setPwErrors((p) => ({ ...p, password: undefined }));
                }}
                onConfirmChange={(v) => {
                  setConfirmPassword(v);
                  setPwErrors((p) => ({ ...p, confirm: undefined }));
                }}
              />
            </div>
          </CascadeSection>
        )}

        <button
          type="submit"
          disabled={buttonDisabled}
          className={submitClass(dark, buttonDisabled)}
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="relative w-full min-h-screen md:min-h-0 md:h-[calc(100vh-2.5rem)] md:overflow-hidden md:rounded-2xl">
      {/* ── Background animation — full card, z-1 ─────────────── */}
      <div className="hidden md:block absolute inset-0 z-[1] pointer-events-none overflow-hidden rounded-2xl">
        <Grainient
          color1="#22569d"
          color2={grainAccent}
          color3={grainAccent}
          timeSpeed={0.7}
          colorBalance={0}
          warpStrength={1}
          warpFrequency={5}
          warpSpeed={2}
          warpAmplitude={50}
          blendAngle={0}
          blendSoftness={0.05}
          rotationAmount={500}
          noiseScale={2}
          grainAmount={0.05}
          grainScale={0.5}
          grainAnimated={false}
          contrast={1.5}
          gamma={1}
          saturation={1}
          centerX={0.5}
          centerY={0.1}
          zoom={0.5}
          maxDpr={2}
          fps={60}
        />
      </div>

      {/* ── Overlay — logo and tagline on the animation ─────────── */}
      <div
        className="hidden md:block absolute inset-0 z-10"
        style={{ pointerEvents: "none" }}
      >
        <Image
          src="/whiteN.svg"
          alt="NormAI"
          width={50}
          height={50}
          className="absolute top-6"
          style={{
            left: "calc(100% - 80px)",
            filter: dark ? "invert(1)" : "none",
            transition: "filter 500ms ease",
          }}
        />

        {/* Tagline centered in the right 60% open area */}
        <div className="absolute inset-0 w-[60%]" style={{ transform: "translateX(66.667%)" }}>
          <PanelTagline dark={dark} />
        </div>
      </div>

      {/* ── Mobile: full-page form ────────────────────────────────── */}
      <div className="md:hidden">{formContent}</div>

      {/* ── White panel — desktop only, fixed on left ─────────────── */}
      <div
        className="hidden md:flex md:flex-col md:justify-start md:overflow-y-auto absolute inset-y-0 z-20"
        style={{
          width: "calc(40% + 2px)",
          left: "-2px",
          top: "-2px",
          bottom: "-2px",
          background: dark ? "#0a0a0a" : "#F0FDF9",
          transition: "background-color 500ms ease",
        }}
      >
        {formContent}
      </div>
    </div>
  );
}
