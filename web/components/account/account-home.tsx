"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Camera, Check, Eye, EyeOff, UserRound,
  AlignLeft, Pencil, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/auth";
import type { User } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────
type SaveState = "idle" | "saving" | "saved" | "error";
type DangerPhase = "idle" | "confirm" | "deleting";
type SecurityTab = "security" | "danger";

// ── Design constants ───────────────────────────────────────────
const CARD = "acct-v2-card rounded-2xl p-6";

const INPUT_BASE = "acct-v2-input w-full h-[42px] rounded-lg text-sm transition";

const LABEL_CLS = "acct-v2-text-secondary block text-xs font-medium mb-1.5";

// Compact inline save (name / title rows)
const BTN_SAVE_INLINE =
  "bg-[var(--acct-brand)] text-white rounded-lg h-[42px] px-4 text-sm font-semibold hover:bg-[var(--acct-brand-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center";

// Standard primary (header, password)
const BTN_PRIMARY =
  "inline-flex items-center gap-2 bg-[var(--acct-brand)] hover:bg-[var(--acct-brand-hover)] text-white font-semibold text-sm rounded-xl px-5 py-2.5 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed";

// Cancel / secondary outline
const BTN_CANCEL =
  "inline-flex items-center gap-2 bg-transparent border border-[var(--acct-brand)] text-[var(--acct-brand)] hover:bg-[var(--acct-brand)]/5 font-semibold text-sm rounded-xl px-5 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

// ── Primitives ─────────────────────────────────────────────────

function InlineFeedback({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saved") return (-
    <span className="inline-flex items-center gap-1 text-xs font-medium text-(--acct-brand) shrink-0">
      <Check className="w-3 h-3" aria-hidden="true" /> Salvo
    </span>
  );
  if (state === "error" && error) return (
    <span className="text-xs font-medium text-[#DC2626] shrink-0" role="alert">{error}</span>
  );
  return null;
}

function Field({
  id, label, value, onChange, placeholder, className = "",
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL_CLS}>{label}</label>
      <input
        id={id} type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_BASE} px-3.5`}
      />
    </div>
  );
}

function PwField({
  id, label, value, onChange, placeholder,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLS}>{label}</label>
      <div className="relative">
        <input
          id={id} type={show ? "text" : "password"} value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_BASE} pl-3.5 pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="acct-v2-icon absolute right-3 top-1/2 -translate-y-1/2"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show
            ? <EyeOff className="w-4 h-4" aria-hidden="true" />
            : <Eye className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

// ── Account Form ───────────────────────────────────────────────

function AccountForm({ user }: { user: User }) {
  const { updateUser, logout } = useAuth();

  // Avatar
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarHovered, setAvatarHovered] = useState(false);

  // Identidade
  const [firstName, setFirstName] = useState(user.name ?? "");
  const [lastName, setLastName] = useState(user.last_name ?? "");
  const [nameDirty, setNameDirty] = useState(false);
  const [nameState, setNameState] = useState<SaveState>("idle");
  const [nameError, setNameError] = useState<string | null>(null);

  const [jobTitle, setJobTitle] = useState("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [titleState, setTitleState] = useState<SaveState>("idle");
  const [titleError, setTitleError] = useState<string | null>(null);

  // Senha
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwState, setPwState] = useState<SaveState>("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  // Perigo
  const [dangerPhase, setDangerPhase] = useState<DangerPhase>("idle");
  const [confirmEmail, setConfirmEmail] = useState("");

  // Tab
  const [activeTab, setActiveTab] = useState<SecurityTab>("security");

  useEffect(() => {
    authApi.getMe().then((p) => {
      setJobTitle((p as typeof p & { job_title?: string }).job_title ?? "");
    }).catch(() => {});
  }, []);

  // ── Handlers ─────────────────────────────────────────────────

  const handleAvatarSelect = useCallback(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Formato inválido. Use JPG, PNG ou WebP."); return;
    }
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Máximo 5 MB."); return; }
    setAvatarError(null);
    setAvatarUploading(true);
    setAvatarPreview(URL.createObjectURL(file));
    try {
      const updated = await authApi.uploadAvatar(file);
      updateUser({ avatar_url: updated.avatar_url });
    } catch { setAvatarError("Falha no upload. Tente novamente."); }
    finally { setAvatarUploading(false); }
  }, [updateUser]);

  const handleSaveName = useCallback(async () => {
    setNameState("saving"); setNameError(null);
    try {
      const u = await authApi.updateProfile({ name: firstName, last_name: lastName });
      updateUser({ name: u.name, last_name: u.last_name });
      setNameState("saved"); setNameDirty(false);
      setTimeout(() => setNameState("idle"), 2500);
    } catch { setNameState("error"); setNameError("Falha ao salvar."); }
  }, [firstName, lastName, updateUser]);

  const handleSaveTitle = useCallback(async () => {
    setTitleState("saving"); setTitleError(null);
    try {
      await authApi.updateProfile({ job_title: jobTitle });
      setTitleState("saved"); setTitleDirty(false);
      setTimeout(() => setTitleState("idle"), 2500);
    } catch { setTitleState("error"); setTitleError("Falha ao salvar."); }
  }, [jobTitle]);

  const handleSavePassword = useCallback(async () => {
    if (newPw !== confirmPw) { setPwError("As senhas não coincidem."); return; }
    if (newPw.length < 8) { setPwError("Mínimo 8 caracteres."); return; }
    setPwState("saving"); setPwError(null);
    try {
      await authApi.changePassword(currentPw, newPw);
      setPwState("saved");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwState("idle"), 2000);
    } catch { setPwState("error"); setPwError("Senha atual incorreta."); }
  }, [currentPw, newPw, confirmPw]);

  const handleDeleteAccount = useCallback(async () => {
    if (confirmEmail !== user.email) return;
    setDangerPhase("deleting");
    try { await authApi.deleteAccount(); await logout(); }
    catch { setDangerPhase("confirm"); }
  }, [confirmEmail, user.email, logout]);

  const handleSaveAll = useCallback(async () => {
    if (nameDirty) await handleSaveName();
    if (titleDirty) await handleSaveTitle();
  }, [nameDirty, titleDirty, handleSaveName, handleSaveTitle]);

  const handleCancel = useCallback(() => {
    setFirstName(user.name ?? "");
    setLastName(user.last_name ?? "");
    setNameDirty(false);
    setNameState("idle");
    setNameError(null);
  }, [user.name, user.last_name]);

  const handleTabKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setActiveTab((t) => t === "security" ? "danger" : "security");
    if (e.key === "ArrowLeft") setActiveTab((t) => t === "danger" ? "security" : "danger");
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlignLeft className="acct-v2-text-primary w-6 h-6" aria-hidden="true" />
          <h1 className="acct-v2-text-primary text-[28px] font-bold leading-tight tracking-tight">
            Gerenciamento de conta
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} className={BTN_CANCEL}>
            Cancelar
          </button>
          <button onClick={handleSaveAll} className={BTN_PRIMARY}>
            <Check className="w-4 h-4" aria-hidden="true" />
            Salvar alterações
          </button>
        </div>
      </div>

      {/* ── 12-col grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Main — col-span-8 */}
        <section className="col-span-12 lg:col-span-8 grid grid-cols-12 gap-4">

          {/* ── Card: Foto de perfil (col-span-4) ─────────── */}
          <div className={`col-span-12 sm:col-span-4 ${CARD} h-full flex flex-col items-center justify-center text-center`}>
            {/* Avatar */}
            <div
              className="w-30 h-30 rounded-full bg-(--acct-brand)/10 flex items-center justify-center relative cursor-pointer overflow-hidden mb-4"
              role="button"
              tabIndex={0}
              aria-label="Alterar foto de perfil"
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
              onMouseEnter={() => setAvatarHovered(true)}
              onMouseLeave={() => setAvatarHovered(false)}
            >
              {avatarPreview ? (
                <Image
                  src={avatarPreview} alt="" width={120} height={120}
                  className="w-full h-full object-cover" unoptimized
                />
              ) : (
                <UserRound className="w-12 h-12 text-(--acct-brand)" aria-hidden="true" />
              )}
              {avatarHovered && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  {avatarUploading
                    ? <span className="acct-avatar-spinner" aria-hidden="true" />
                    : <Camera className="w-5 h-5 text-white" aria-hidden="true" />}
                </div>
              )}
            </div>

            <input
              ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarSelect(f);
                e.target.value = "";
              }}
            />

            <h3 className="acct-v2-text-primary text-base font-semibold">Foto de perfil</h3>
            {avatarError
              ? <p className="text-xs text-[#DC2626] mt-1" role="alert">{avatarError}</p>
              : <p className="acct-v2-text-muted text-xs mt-1">JPG, PNG ou WebP. Máx. 5 MB.</p>}
          </div>

          {/* ── Card: Dados pessoais (col-span-8) ────────── */}
          <div className={`col-span-12 sm:col-span-8 ${CARD} h-full`}>
            <h2 className="acct-v2-text-primary text-lg font-bold mb-5 flex items-center gap-2">
              Dados pessoais
              <Pencil className="acct-v2-text-muted w-4 h-4" aria-hidden="true" />
            </h2>

            {/* Nome + Sobrenome */}
            <div className="grid grid-cols-12 gap-4 items-end mb-4">
              <Field
                id="acct-first-name" label="Nome" value={firstName}
                placeholder="Nome"
                onChange={(v) => { setFirstName(v); setNameDirty(true); setNameState("idle"); }}
                className="col-span-5"
              />
              <Field
                id="acct-last-name" label="Sobrenome" value={lastName}
                placeholder="Sobrenome"
                onChange={(v) => { setLastName(v); setNameDirty(true); setNameState("idle"); }}
                className="col-span-5"
              />
              <div className="col-span-2 flex flex-col gap-1 items-stretch">
                <button
                  className={BTN_SAVE_INLINE}
                  disabled={!nameDirty || nameState === "saving"}
                  onClick={handleSaveName}
                  aria-label="Salvar nome"
                >
                  {nameState === "saving" ? "…" : "Salvar"}
                </button>
                <InlineFeedback state={nameState} error={nameError} />
              </div>
            </div>

            {/* Cargo */}
            <div className="grid grid-cols-12 gap-4 items-end">
              <Field
                id="acct-job-title" label="Cargo" value={jobTitle}
                placeholder="Seu cargo"
                onChange={(v) => { setJobTitle(v); setTitleDirty(true); setTitleState("idle"); }}
                className="col-span-10"
              />
              <div className="col-span-2 flex flex-col gap-1 items-stretch">
                <button
                  className={BTN_SAVE_INLINE}
                  disabled={!titleDirty || titleState === "saving"}
                  onClick={handleSaveTitle}
                  aria-label="Salvar cargo"
                >
                  {titleState === "saving" ? "…" : "Salvar"}
                </button>
                <InlineFeedback state={titleState} error={titleError} />
              </div>
            </div>
          </div>

          {/* ── Card: Segurança / Zona de perigo (col-span-12) ── */}
          <div className={`col-span-12 ${CARD}`}>
            {/* Tab bar */}
            <nav
              className="acct-v2-tab-bar flex items-center gap-8 border-b mb-6"
              role="tablist"
              aria-label="Seções de segurança"
              onKeyDown={handleTabKey}
            >
              {(["security", "danger"] as const).map((tab) => {
                const labels: Record<SecurityTab, string> = {
                  security: "Segurança",
                  danger: "Zona de perigo",
                };
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    role="tab"
                    id={`tab-btn-${tab}`}
                    aria-selected={active}
                    aria-controls={`tab-panel-${tab}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-(--acct-brand)focus-visible:outline-offset-2 rounded-sm ${
                      active ? "text-(--acct-brand)" : "acct-v2-tab-inactive"
                    }`}
                  >
                    {labels[tab]}
                    {active && (
                      <span className="absolute bottom-px left-0 right-0 h-0.5 bg-(--acct-brand) rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Tab: Segurança */}
            <div
              role="tabpanel"
              id="tab-panel-security"
              aria-labelledby="tab-btn-security"
              hidden={activeTab !== "security"}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 max-w-160">
                <PwField
                  id="acct-current-pw" label="Senha atual" placeholder="Senha atual"
                  value={currentPw} onChange={(v) => { setCurrentPw(v); setPwError(null); }}
                />
                <div />
                <PwField
                  id="acct-new-pw" label="Nova senha" placeholder="Nova senha"
                  value={newPw} onChange={(v) => { setNewPw(v); setPwError(null); }}
                />
                <PwField
                  id="acct-confirm-pw" label="Confirmar nova senha" placeholder="Repita a nova senha"
                  value={confirmPw} onChange={(v) => { setConfirmPw(v); setPwError(null); }}
                />
              </div>

              {pwError && (
                <p className="mt-3 text-xs font-medium text-[#DC2626]" role="alert">{pwError}</p>
              )}
              {pwState === "saved" && (
                <p className="mt-3 text-xs font-medium text-(--acct-brand) flex items-center gap-1">
                  <Check className="w-3 h-3" aria-hidden="true" /> Senha alterada
                </p>
              )}

              <button
                className={`mt-6 ${BTN_PRIMARY}`}
                disabled={!currentPw || !newPw || !confirmPw || pwState === "saving" || pwState === "saved"}
                onClick={handleSavePassword}
              >
                {pwState === "saving" ? "Salvando…" : "Salvar senha"}
              </button>
            </div>

            {/* Tab: Zona de perigo */}
            <div
              role="tabpanel"
              id="tab-panel-danger"
              aria-labelledby="tab-btn-danger"
              hidden={activeTab !== "danger"}
            >
              {dangerPhase === "idle" && (
                <div className="max-w-120">
                  <p className="acct-v2-text-secondary text-sm leading-relaxed">
                    A exclusão da conta remove permanentemente todos os dados associados. Esta ação não pode ser desfeita.
                  </p>
                  <div className="mt-10">
                    <button
                      onClick={() => setDangerPhase("confirm")}
                      className="acct-v2-btn-danger inline-flex items-center gap-2 text-white font-semibold text-sm rounded-xl px-5 py-2.5 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      Excluir conta
                    </button>
                  </div>
                </div>
              )}

              {dangerPhase !== "idle" && (
                <div className="max-w-120 flex flex-col gap-4">
                  <p className="acct-v2-text-secondary text-sm leading-relaxed">
                    Esta ação não pode ser desfeita. Confirme seu e-mail para continuar.
                  </p>
                  <div>
                    <label htmlFor="acct-confirm-email" className={LABEL_CLS}>Seu e-mail</label>
                    <input
                      id="acct-confirm-email" type="email" value={confirmEmail}
                      placeholder="seu@email.com"
                      disabled={dangerPhase === "deleting"}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      className={`${INPUT_BASE} px-3.5`}
                    />
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={confirmEmail !== user.email || dangerPhase === "deleting"}
                      className="acct-v2-btn-danger inline-flex items-center gap-2 text-white font-semibold text-sm rounded-xl px-5 py-2.5"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      {dangerPhase === "deleting" ? "Excluindo…" : "Confirmar exclusão"}
                    </button>
                    <button
                      onClick={() => { setDangerPhase("idle"); setConfirmEmail(""); }}
                      disabled={dangerPhase === "deleting"}
                      className={BTN_CANCEL}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Aside — col-span-4 — placeholder cards */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="acct-v2-card rounded-2xl min-h-45" />
          <div className="acct-v2-card rounded-2xl min-h-45" />
          <div className="acct-v2-card rounded-2xl min-h-45" />
        </aside>
      </div>
    </>
  );
}

// ── Shell ──────────────────────────────────────────────────────

export function AccountHome() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="acct-page h-full flex items-center justify-center">
      <p className="acct-v2-text-muted text-sm">Carregando…</p>
    </div>
  );

  if (!user) return null;

  return (
    <div className="acct-page h-full overflow-auto py-8">
      <div className="mx-auto max-w-7xl w-full px-8">
        <AccountForm key={user.id} user={user} />
      </div>
    </div>
  );
}
