"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import type { DictionaryEntry, EntryKind, CreateEntryInput, UpdateEntryInput } from "@/types/dictionary";

interface Props {
  entry: DictionaryEntry | null; // null = new
  onSave: (input: CreateEntryInput | UpdateEntryInput, entryId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

type Draft = {
  kind: EntryKind;
  name: string;
  description: string;
  items: string[];
  content: string;
};

const KIND_LABELS: Record<EntryKind, string> = {
  categories: "Categorias",
  context: "Contexto IA",
};

function emptyDraft(entry: DictionaryEntry | null): Draft {
  if (!entry) {
    return {
      kind: "categories",
      name: "",
      description: "",
      items: [],
      content: "",
    };
  }
  return {
    kind: entry.kind,
    name: entry.name,
    description: entry.description,
    items: entry.items ?? [],
    content: entry.content ?? "",
  };
}

function getMissingFields(draft: Draft): string[] {
  const missing: string[] = [];
  if (!draft.name.trim()) missing.push("título");
  if (draft.kind === "categories" && draft.items.length === 0) missing.push("categorias");
  if (draft.kind === "context" && !draft.content.trim()) missing.push("instrução para IA");
  return missing;
}

export function DictEditor({ entry, onSave, onDelete, onClose }: Props) {
  const isNew = !entry;
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(entry));
  const [chipInput, setChipInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [titleHovered, setTitleHovered] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const chipInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (isNew) setTimeout(() => titleInputRef.current?.focus(), 60);
  }, [isNew]);

  useEffect(() => () => {
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
  }, []);

  function showValidation(msg: string) {
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    setValidationMsg(msg);
    validationTimerRef.current = setTimeout(() => setValidationMsg(null), 3500);
  }

  function updateDraft<K extends keyof Draft>(key: K, val: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function addChip() {
    const raw = chipInput.trim().replace(/,$/, "");
    if (!raw) return;
    const newItems = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateDraft("items", [...draft.items, ...newItems]);
    setChipInput("");
  }

  function removeChip(i: number) {
    updateDraft(
      "items",
      draft.items.filter((_, idx) => idx !== i),
    );
  }

  async function handleSave() {
    const missing = getMissingFields(draft);
    if (missing.length === 1) {
      const labels: Record<string, string> = {
        "título": "Informe o título da preferência",
        "categorias": "Adicione ao menos uma categoria",
        "instrução para IA": "Informe a instrução para IA",
      };
      showValidation(labels[missing[0]] ?? `Informe o campo: ${missing[0]}`);
      if (missing[0] === "título") titleInputRef.current?.focus();
      return;
    }
    if (missing.length > 1) {
      showValidation("Alguns campos precisam ser preenchidos");
      return;
    }
    const input = {
      kind: draft.kind,
      name: draft.name.trim(),
      description: draft.description.trim(),
      ...(draft.kind === "categories" && { items: draft.items }),
      ...(draft.kind === "context" && { content: draft.content }),
    };
    setSaving(true);
    try {
      await onSave(input, entry?.id);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    background: "var(--bg-surface)",
    color: "var(--text-default)",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 150ms ease",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    marginBottom: "8px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };

  return (
    <div
      className="dict-modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "Nova entrada no dicionário" : "Editar entrada"}
    >
      <div
        className="dict-modal-panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "22px 24px 18px",
            borderBottom: "1px solid var(--border-default)",
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--text-accent)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-accent)",
                }}
              >
                {isNew ? "Nova entrada" : "Editar entrada"}
              </span>
            </div>

            <input
              ref={titleInputRef}
              type="text"
              value={draft.name}
              onChange={(e) => updateDraft("name", e.target.value)}
              placeholder={isNew ? "Título da preferência" : "Sem título"}
              maxLength={120}
              className="dict-modal-title-input"
              onMouseEnter={() => setTitleHovered(true)}
              onMouseLeave={() => setTitleHovered(false)}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              style={{
                display: "block",
                width: "100%",
                padding: "3px 0",
                fontSize: "21px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                color: "var(--text-default)",
                background: "none",
                border: "none",
                borderBottom: `1.5px solid ${titleFocused ? "var(--border-focus, #006b5a)" : titleHovered ? "var(--border-strong)" : "transparent"}`,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color 130ms ease",
                cursor: "text",
              }}
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar editor"
            style={{
              background: "none",
              border: "none",
              padding: "6px",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              borderRadius: "6px",
              marginTop: "18px",
              flexShrink: 0,
              transition: "color 120ms ease, background 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-default)";
              e.currentTarget.style.background = "var(--bg-subtle)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "none";
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div
          className="scroll-styled"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          {/* Kind selector — only shown when creating */}
          {isNew && (
            <div>
              <label style={labelStyle}>Tipo</label>
              <div role="group" style={{ display: "flex", gap: "6px" }}>
                {(["categories", "context"] as EntryKind[]).map(
                  (k) => {
                    const active = draft.kind === k;
                    const col =
                      k === "categories"
                        ? "#006b5a"
                        : "#6b4cc7";
                    return (
                      <button
                        key={k}
                        onClick={() => updateDraft("kind", k)}
                        aria-pressed={active}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          border: `1px solid ${active ? col : "var(--border-strong)"}`,
                          background: active ? `${col}18` : "transparent",
                          color: active ? col : "var(--text-secondary)",
                          fontSize: "13px",
                          fontWeight: active ? 600 : 400,
                          cursor: "pointer",
                          transition: "all 120ms ease",
                        }}
                      >
                        {KIND_LABELS[k]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label style={{ ...labelStyle, marginBottom: "6px" }}>
              Descrição
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => updateDraft("description", e.target.value)}
              placeholder="Em que contexto aplicar esta preferência"
              rows={2}
              maxLength={500}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--border-focus)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
            />
          </div>

          {/* Kind-specific editor */}
          {draft.kind === "categories" && (
            <div>
              <label style={labelStyle}>Categorias</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "24px",
                }}
              >
                {draft.items.map((item, i) => (
                  <span key={i} className="dict-chip">
                    {item}
                    <button
                      className="dict-chip__remove"
                      onClick={() => removeChip(i)}
                      aria-label={`Remover ${item}`}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  ref={chipInputRef}
                  type="text"
                  value={chipInput}
                  onChange={(e) => setChipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addChip();
                    }
                    if (
                      e.key === "Backspace" &&
                      !chipInput &&
                      draft.items.length > 0
                    ) {
                      updateDraft("items", draft.items.slice(0, -1));
                    }
                  }}
                  placeholder="Adicionar (Enter ou vírgula)"
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-focus)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                  }}
                />
                <button
                  onClick={addChip}
                  style={{
                    padding: "0 14px",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "6px",
                    background: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Plus size={15} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          {draft.kind === "context" && (
            <div>
              <label style={{ ...labelStyle, marginBottom: "6px" }}>
                Instrução para IA
              </label>
              <textarea
                value={draft.content}
                onChange={(e) => updateDraft("content", e.target.value)}
                placeholder="Como a IA deve interpretar e tratar os dados desta coluna"
                rows={6}
                maxLength={4000}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-focus)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                }}
              />
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                Injetada no contexto antes do processamento da coluna.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-default)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {validationMsg ? (
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "oklch(48% 0.18 25)",
                  animation: "fadeSlideUp 140ms ease-out",
                }}
              >
                {validationMsg}
              </span>
            ) : !isNew && (
              <button
                onClick={() => onDelete(entry.id).catch(console.error)}
                disabled={saving}
                style={{
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: "7px",
                  background: "rgba(220,38,38,0.08)",
                  color: "#dc2626",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  cursor: saving ? "not-allowed" : "pointer",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(220,38,38,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(220,38,38,0.08)";
                }}
              >
                Remover
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "8px 14px",
                border: "none",
                borderRadius: "6px",
                background: "none",
                color: "var(--text-muted)",
                fontSize: "13.5px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "color 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 20px",
                border: "none",
                borderRadius: "6px",
                background: saving ? "var(--bg-subtle)" : "#006b5a",
                color: saving ? "var(--text-muted)" : "oklch(97% 0.006 165)",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                transition: "background 150ms ease",
              }}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
