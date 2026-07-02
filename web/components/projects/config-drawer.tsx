"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronRight,
  FileText,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type {
  ColumnProcessingConfig,
  ColumnProcessingConfigMap,
  NormalizationType,
  NormalizedFile,
} from "@/types/project";

const NORM_TYPES: { id: NormalizationType; label: string; desc: string }[] = [
  { id: "trim", label: "Trim", desc: "Remove espacos extras" },
  { id: "nulls", label: "Nulls", desc: "Trata valores vazios" },
  { id: "split", label: "Split", desc: "Divide por separadores" },
  { id: "suffixes", label: "Sufixos", desc: "Remove sufixos de orgaos" },
  { id: "abbreviate", label: "Abreviar", desc: "Abrevia nomes juridicos" },
  { id: "accents", label: "Acentos", desc: "Remove acentuacao" },
  { id: "capitalize", label: "Capitalizar", desc: "Capitalizacao PT-BR" },
];

const EMPTY_CONFIG: ColumnProcessingConfig = {
  normalizationTypes: [],
  classify: false,
};

interface ConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  columns: string[];
  columnConfigs: ColumnProcessingConfigMap;
  normalizedFile: NormalizedFile | null;
  hasProcessed: boolean;
  onEditNormalization: () => void;
  onOpenNormalized: () => void;
  onColumnConfigsChange: (configs: ColumnProcessingConfigMap) => void;
}

export function ConfigDrawer({
  open,
  onClose,
  columns,
  columnConfigs,
  normalizedFile,
  hasProcessed,
  onEditNormalization,
  onOpenNormalized,
  onColumnConfigsChange,
}: ConfigDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
      setVisible(true);
    } else if (visible) {
      setClosing(true);
      closeTimer.current = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 300);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedColumn((current) => {
      if (current && columns.includes(current)) return current;
      return columns[0] ?? null;
    });
  }, [open, columns]);

  const handleClose = useCallback(() => {
    if (!closing) onClose();
  }, [closing, onClose]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, handleClose]);

  const selectedConfig = selectedColumn
    ? columnConfigs[selectedColumn] ?? EMPTY_CONFIG
    : EMPTY_CONFIG;

  const configuredCount = columns.filter((column) => {
    const config = columnConfigs[column];
    return config && (config.classify || config.normalizationTypes.length > 0);
  }).length;

  const classifiedColumns = columns.filter((column) => columnConfigs[column]?.classify);
  const resultColumns = classifiedColumns.map((column) => `${column}_categoria`);

  function updateSelectedConfig(patch: Partial<ColumnProcessingConfig>) {
    if (!selectedColumn) return;
    const current = columnConfigs[selectedColumn] ?? EMPTY_CONFIG;
    onColumnConfigsChange({
      ...columnConfigs,
      [selectedColumn]: {
        normalizationTypes: patch.normalizationTypes ?? current.normalizationTypes,
        classify: patch.classify ?? current.classify,
      },
    });
  }

  function toggleNorm(type: NormalizationType) {
    const current = selectedConfig.normalizationTypes;
    const next = current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type];
    updateSelectedConfig({ normalizationTypes: next });
  }

  function toggleAllNorms() {
    const allSelected = selectedConfig.normalizationTypes.length === NORM_TYPES.length;
    updateSelectedConfig({
      normalizationTypes: allSelected ? [] : NORM_TYPES.map((type) => type.id),
    });
  }

  if (!mounted || !visible) return null;

  const drawer = (
    <>
      <div
        className="sb-drawer-scrim"
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "oklch(0% 0 0 / 0.32)",
          zIndex: 449,
          animation: closing
            ? "sb-scrim-out 260ms ease forwards"
            : "sb-scrim-in 200ms ease both",
        }}
      />

      <div
        className="sb-drawer-panel"
        role="dialog"
        aria-label="Configuracoes por coluna"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "560px",
          background: "var(--bg-surface, var(--bg-base))",
          borderLeft: "1px solid var(--border-default)",
          zIndex: 450,
          display: "flex",
          flexDirection: "column",
          animation: closing
            ? "sb-drawer-out 280ms cubic-bezier(0.4, 0, 1, 1) forwards"
            : "sb-drawer-in 300ms cubic-bezier(0.16, 1, 0.3, 1) both",
          boxShadow: "-8px 0 40px -4px oklch(0% 0 0 / 0.14)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 18px",
            borderBottom: "1px solid var(--border-default)",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text-default)",
                fontFamily: "var(--font-space-grotesk)",
              }}
            >
              Configuracao por coluna
            </h2>
            <div
              style={{
                marginTop: "4px",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {configuredCount} de {columns.length} colunas configuradas
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar configuracoes"
            style={iconButtonStyle}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {columns.length === 0 ? (
          <div
            style={{
              flex: 1,
              padding: "32px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--text-secondary)",
                fontSize: "13px",
                lineHeight: 1.55,
              }}
            >
              Selecione uma coluna no arquivo para definir normalizacoes e
              classificacao por IA apenas nela.
            </p>
            <button onClick={onEditNormalization} style={ghostBtnStyle}>
              <SlidersHorizontal size={13} strokeWidth={2} />
              Selecionar coluna no arquivo
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "210px 1fr" }}>
            <aside
              className="scroll-styled"
              style={{
                borderRight: "1px solid var(--border-default)",
                overflowY: "auto",
                padding: "16px 12px",
              }}
            >
              {columns.map((column) => {
                const config = columnConfigs[column] ?? EMPTY_CONFIG;
                const selected = column === selectedColumn;
                const configured = config.classify || config.normalizationTypes.length > 0;
                return (
                  <button
                    key={column}
                    type="button"
                    onClick={() => setSelectedColumn(column)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      minHeight: "38px",
                      border: "none",
                      borderRadius: "8px",
                      padding: "7px 8px",
                      background: selected ? "var(--bg-tinted)" : "transparent",
                      color: selected ? "var(--text-default)" : "var(--text-secondary)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "5px",
                        border: configured
                          ? "1px solid var(--primary-700)"
                          : "1px solid var(--border-default)",
                        background: configured ? "var(--primary-700)" : "transparent",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {configured && <Check size={11} color="white" strokeWidth={2.5} />}
                    </span>
                    <code
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    >
                      {column}
                    </code>
                    {selected && (
                      <ChevronRight
                        size={13}
                        strokeWidth={2}
                        style={{ marginLeft: "auto", flexShrink: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </aside>

            <main className="scroll-styled" style={{ overflowY: "auto", padding: "24px" }}>
              {selectedColumn && (
                <ColumnSettings
                  column={selectedColumn}
                  config={selectedConfig}
                  onToggleNorm={toggleNorm}
                  onToggleAllNorms={toggleAllNorms}
                  onClassifyChange={(classify) => updateSelectedConfig({ classify })}
                />
              )}

              <div
                style={{
                  borderTop: "1px solid var(--border-default)",
                  margin: "28px 0",
                }}
              />

              <section>
                <h3 style={sectionLabelStyle}>Arquivo</h3>
                <button
                  onClick={() => {
                    onClose();
                    onEditNormalization();
                  }}
                  style={ghostBtnStyle}
                >
                  <SlidersHorizontal size={13} strokeWidth={2} />
                  Alterar colunas selecionadas
                </button>
              </section>

              {hasProcessed && resultColumns.length > 0 && (
                <section style={{ marginTop: "28px" }}>
                  <h3 style={sectionLabelStyle}>Colunas geradas</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {resultColumns.map((column) => (
                      <span key={column} style={generatedColumnStyle}>
                        {column}
                      </span>
                    ))}
                  </div>
                  {normalizedFile && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenNormalized();
                      }}
                      style={{ ...ghostBtnStyle, marginTop: "14px" }}
                    >
                      <FileText size={13} strokeWidth={2} />
                      Abrir arquivo normalizado
                    </button>
                  )}
                </section>
              )}
            </main>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(drawer, document.body);
}

function ColumnSettings({
  column,
  config,
  onToggleNorm,
  onToggleAllNorms,
  onClassifyChange,
}: {
  column: string;
  config: ColumnProcessingConfig;
  onToggleNorm: (type: NormalizationType) => void;
  onToggleAllNorms: () => void;
  onClassifyChange: (classify: boolean) => void;
}) {
  const allSelected = useMemo(
    () => config.normalizationTypes.length === NORM_TYPES.length,
    [config.normalizationTypes.length],
  );

  return (
    <section>
      <h3 style={sectionLabelStyle}>Coluna selecionada</h3>
      <code
        style={{
          display: "inline-flex",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "4px 8px",
          borderRadius: "6px",
          background: "var(--bg-subtle)",
          color: "var(--text-default)",
          border: "1px solid var(--border-default)",
          fontSize: "12px",
          fontFamily: "monospace",
          marginBottom: "22px",
        }}
      >
        {column}
      </code>

      <h3 style={sectionLabelStyle}>Normalizacoes desta coluna</h3>
      <div
        style={{
          border: "1px solid var(--border-default)",
          borderRadius: "10px",
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        <button type="button" onClick={onToggleAllNorms} style={normRowStyle(true)}>
          <CheckBox checked={allSelected} indeterminate={config.normalizationTypes.length > 0 && !allSelected} />
          <span>
            <strong style={normTitleStyle}>Marcar todas</strong>
            <span style={normDescStyle}>Aplica todos os tipos nesta coluna</span>
          </span>
        </button>

        {NORM_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onToggleNorm(type.id)}
            style={normRowStyle(false)}
          >
            <CheckBox checked={config.normalizationTypes.includes(type.id)} />
            <span>
              <strong style={normTitleStyle}>{type.label}</strong>
              <span style={normDescStyle}>{type.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <h3 style={sectionLabelStyle}>Classificacao por IA</h3>
      <button
        type="button"
        onClick={() => onClassifyChange(!config.classify)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "14px",
          borderRadius: "10px",
          border: config.classify
            ? "1px solid color-mix(in oklch, var(--primary-700) 40%, transparent)"
            : "1px solid var(--border-default)",
          background: config.classify
            ? "color-mix(in oklch, var(--primary-700) 8%, transparent)"
            : "transparent",
          color: "var(--text-default)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            background: config.classify ? "var(--primary-700)" : "var(--bg-subtle)",
            color: config.classify ? "white" : "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Sparkles size={15} strokeWidth={2} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <strong style={{ fontSize: "13px", fontWeight: 700 }}>
            Classificar somente esta coluna
          </strong>
          <span style={{ color: "var(--text-secondary)", fontSize: "12.5px", lineHeight: 1.45 }}>
            A IA usa o contexto do projeto e cria <code style={{ fontFamily: "monospace" }}>
              {column}_categoria
            </code>{" "}
            apenas para esta coluna.
          </span>
        </span>
      </button>
    </section>
  );
}

function CheckBox({
  checked,
  indeterminate = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: "16px",
        height: "16px",
        borderRadius: "5px",
        border: checked || indeterminate
          ? "1px solid var(--primary-700)"
          : "1px solid var(--border-strong)",
        background: checked || indeterminate ? "var(--primary-700)" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {checked && <Check size={11} color="white" strokeWidth={2.5} />}
      {indeterminate && (
        <span style={{ width: "8px", height: "2px", borderRadius: "2px", background: "white" }} />
      )}
    </span>
  );
}

function normRowStyle(header: boolean): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "11px",
    padding: header ? "12px 14px" : "11px 14px",
    border: "none",
    borderBottom: "1px solid var(--border-default)",
    background: header ? "var(--bg-subtle)" : "transparent",
    color: "var(--text-default)",
    cursor: "pointer",
    textAlign: "left",
  };
}

const sectionLabelStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "var(--text-muted)",
};

const normTitleStyle: React.CSSProperties = {
  display: "block",
  color: "var(--text-default)",
  fontSize: "13px",
  fontWeight: 650,
};

const normDescStyle: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "var(--text-muted)",
  fontSize: "11.5px",
};

const iconButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "30px",
  height: "30px",
  borderRadius: "7px",
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border-default)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
};

const generatedColumnStyle: React.CSSProperties = {
  padding: "3px 9px",
  borderRadius: "6px",
  background: "color-mix(in oklch, var(--primary-700, oklch(38% 0.12 165)) 8%, transparent)",
  color: "var(--primary-700, oklch(38% 0.12 165))",
  fontSize: "12px",
  fontFamily: "monospace",
  fontWeight: 500,
  border: "1px solid color-mix(in oklch, var(--primary-700, oklch(38% 0.12 165)) 22%, transparent)",
  lineHeight: 1.5,
};
