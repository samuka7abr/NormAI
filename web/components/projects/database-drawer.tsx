"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download, Search, Loader2 } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useEscape } from "@/hooks/use-escape";
import type { UploadedFile, NormalizedFile } from "@/types/project";

const DRAWER_DEFAULT_W = 800;

/* ── Fuzzy search helpers ────────────────────────────────────── */
function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalize(s: string) {
  return stripAccents(s).toLowerCase();
}
/** Returns edit distance, capped at 2 for performance. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}
/** Score: 0 = exact, 1 = starts-with, 2 = contains, 3 = 1-char typo, 4 = no match. */
function matchScore(query: string, col: string): number {
  if (!query) return 0;
  const q = normalize(query), c = normalize(col);
  if (c === q) return 0;
  if (c.startsWith(q)) return 1;
  if (c.includes(q)) return 2;
  if (editDistance(q, c) <= 1) return 3;
  // sliding window: check if any substring of c matches q with dist ≤ 1
  for (let i = 0; i <= c.length - q.length + 1; i++) {
    if (editDistance(q, c.slice(i, i + q.length + 1)) <= 1) return 3;
  }
  return 4;
}
const DRAWER_MIN_W     = 400;
const DRAWER_MAX_W     = 1200;

/* ── Constants ───────────────────────────────────────────────── */
const NULL_VALUES = new Set(["NA", "Não informado", "Não aplicável", "null", "NULL", ""]);

function isNull(v: string) { return NULL_VALUES.has(v.trim()); }
function hasPipe(v: string) { return v.includes("|") || v.includes("/"); }

/* ── Mock preview data ───────────────────────────────────────── */
type PreviewData = { columns: string[]; rows: string[][] };

function getMockPreview(fileName: string): PreviewData {
  if (fileName.includes("improbidade") || fileName.includes("normalized")) {
    return {
      columns: ["#", "réu", "réu_normalizado", "cargo", "cargo_categoria", "município", "uf", "tribunal", "número_processo", "data_ajuizamento", "valor_ressarcimento", "valor_multa", "tipo_ato", "situação", "situação_categoria"],
      rows: [
        ["0", "JOSE SILVA SANTOS", "José Silva Santos", "Prefeito Municipal", "Executivo Municipal", "São Paulo", "SP", "TJSP", "0012345-22.2019.8.26.0000", "14/03/2019", "R$ 120.000,00", "R$ 60.000,00", "Dano ao erário", "Condenado", "condenado"],
        ["1", "Maria Oliveira", "Maria Oliveira", "Secretária de Saúde", "Executivo Municipal", "Rio de Janeiro", "RJ", "TJRJ", "0009821-11.2020.8.19.0000", "02/07/2020", "NA", "NA", "Enriquecimento ilícito", "Absolvido", "absolvido"],
        ["2", "ANA PAULA RODRIGUES", "Ana Paula Rodrigues", "Vereador", "Legislativo Municipal", "Belo Horizonte", "MG", "TJMG", "0034512-88.2018.8.13.0000", "19/11/2018", "R$ 45.000,00", "R$ 22.500,00", "Dano ao erário", "Processando", "em_andamento"],
        ["3", "Carlos|Roberto Ferreira", "Carlos Roberto Ferreira", "Dir. Financeiro", "Administração Direta", "Curitiba", "PR", "TJPR", "0056234-44.2021.8.16.0000", "08/01/2021", "R$ 89.500,00", "Não informado", "Dano ao erário", "Condenado", "condenado"],
        ["4", "LUIZ HENRIQUE ALVES", "Luiz Henrique Alves", "Prefeito Municipal", "Executivo Municipal", "Salvador", "BA", "TJBA", "0078901-33.2017.8.05.0000", "25/06/2017", "Não informado", "R$ 150.000,00", "Violação a princípios", "Absolvido", "absolvido"],
        ["5", "fernanda souza lima", "Fernanda Souza Lima", "Secretário de Obras", "Executivo Municipal", "Fortaleza", "CE", "TJCE", "0023456-77.2022.8.06.0000", "30/03/2022", "R$ 230.000,00", "R$ 115.000,00", "Dano ao erário", "Condenado", "condenado"],
        ["6", "Pedro Costa", "Pedro Costa", "Vereador", "Legislativo Municipal", "Manaus", "AM", "TJAM", "0011234-55.2020.8.04.0000", "14/09/2020", "NA", "NA", "Enriquecimento ilícito", "Processando", "em_andamento"],
        ["7", "MARCIA APARECIDA NUNES", "Márcia Aparecida Nunes", "Prefeito Municipal", "Executivo Municipal", "Recife", "PE", "TJPE", "0099012-66.2019.8.17.0000", "11/12/2019", "R$ 67.000,00", "R$ 33.500,00", "Dano ao erário", "Absolvido", "absolvido"],
      ],
    };
  }
  return {
    columns: ["#", "acusado", "acusado_normalizado", "vítima", "espécie", "espécie_categoria", "raça", "data_ocorrência", "hora_ocorrência", "município", "uf", "delegacia", "número_bo", "tipo_maus_tratos", "situação_animal", "desfecho"],
    rows: [
      ["0", "JOAO DA SILVA", "João da Silva", "Cachorro", "Canina", "cao", "Vira-lata", "12/01/2024", "14:30", "São Paulo", "SP", "1ª DP - Centro", "BO-2024-00123", "Abandono", "Resgatado", "Encaminhado abrigo"],
      ["1", "maria jose santos", "Maria José Santos", "Gato/Cachorro", "Felina", "gato", "Siamês", "NA", "NULL", "Campinas", "SP", "5ª DP - Norte", "BO-2024-00456", "Maus tratos físicos", "Óbito", "Inquérito aberto"],
      ["2", "CARLOS ROBERTO", "Carlos Roberto", "Cavalo", "Equina", "equino", "Quarto de Milha", "23/03/2024", "09:15", "Ribeirão Preto", "SP", "3ª DP - Sul", "BO-2024-00789", "Negligência", "Tratamento veterinário", "Autuado"],
      ["3", "Ana Paula", "Ana Paula", "Não informado", "Não aplicável", "NULL", "NULL", "15/04/2024", "NULL", "Santos", "SP", "2ª DP - Leste", "BO-2024-01012", "Abandono", "Não localizado", "Arquivado"],
      ["4", "PEDRO HENRIQUE LIMA", "Pedro Henrique Lima", "Cachorro", "Canina", "cao", "Golden Retriever", "02/05/2024", "18:45", "São Paulo", "SP", "1ª DP - Centro", "BO-2024-01345", "Maus tratos físicos", "Resgatado", "Autuado"],
      ["5", "lucia ferreira|costa", "Lúcia Ferreira Costa", "Gato", "Felina", "gato", "Persa", "18/05/2024", "11:00", "Guarulhos", "SP", "4ª DP - Oeste", "BO-2024-01678", "Negligência", "Tratamento veterinário", "Inquérito aberto"],
      ["6", "ROBERTO SOUZA", "Roberto Souza", "Pássaro", "Silvestre", "ave_silvestre", "Papagaio", "NULL", "NULL", "Osasco", "SP", "3ª DP - Sul", "BO-2024-01901", "Tráfico", "Apreendido", "Encaminhado IBAMA"],
      ["7", "fernanda alves", "Fernanda Alves", "Cachorro", "Canina", "cao", "Pit Bull", "29/05/2024", "20:10", "São Bernardo", "SP", "5ª DP - Norte", "BO-2024-02234", "Maus tratos físicos", "Resgatado", "Autuado"],
    ],
  };
}

/* ── Toast hook ──────────────────────────────────────────────── */
function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function show(msg: string) {
    clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => setMessage(null), 2200);
  }

  return { message, show };
}

/* ── Props ───────────────────────────────────────────────────── */
interface DatabaseDrawerProps {
  open: boolean;
  onClose: () => void;
  file: UploadedFile | NormalizedFile;
  isNormalized: boolean;
  normalizedPreviewLoading?: boolean;
  markedColumns: string[];
  onColumnsChange: (cols: string[]) => void;
}

/* ── Component ───────────────────────────────────────────────── */
export function DatabaseDrawer({
  open,
  onClose,
  file,
  isNormalized,
  normalizedPreviewLoading = false,
  markedColumns,
  onColumnsChange,
}: DatabaseDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const { message: toastMsg, show: showToast } = useToast();
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [visibilitySearch, setVisibilitySearch] = useState("");
  const [visibilitySortAlpha, setVisibilitySortAlpha] = useState(false);
  const [markSearch, setMarkSearch] = useState("");
  // `visible` trails `open` by one animation frame so the browser paints the
  // closed position first, giving CSS transitions something to animate from.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
    }
  }, [open]);

  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DRAWER_DEFAULT_W;
    const saved = localStorage.getItem("drawer-width");
    return saved ? Math.max(DRAWER_MIN_W, Math.min(DRAWER_MAX_W, parseInt(saved, 10))) : DRAWER_DEFAULT_W;
  });
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const drawerDragRef = useRef({ startX: 0, startW: 0 });

  useEffect(() => {
    if (isResizingDrawer) return;
    const t = setTimeout(() => localStorage.setItem("drawer-width", String(drawerWidth)), 300);
    return () => clearTimeout(t);
  }, [drawerWidth, isResizingDrawer]);

  function onDrawerResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    drawerDragRef.current = { startX: e.clientX, startW: drawerWidth };
    setIsResizingDrawer(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      // dragging left = wider (panel grows leftward from right edge)
      const newW = drawerDragRef.current.startW + (drawerDragRef.current.startX - ev.clientX);
      const maxVw = Math.floor(window.innerWidth * 0.92);
      const clamped = Math.max(DRAWER_MIN_W, Math.min(DRAWER_MAX_W, newW, maxVw));
      setDrawerWidth(clamped);
    }

    function onUp() {
      setIsResizingDrawer(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  useFocusTrap(panelRef, open);
  useEscape(onClose, open);

  // Reset hidden columns when file changes
  useEffect(() => { setHiddenColumns([]); }, [file.name]);

  const realPreview = (file as { preview?: { columns: string[]; rows: string[][] } }).preview;
  const hasRealPreview = !!realPreview;
  const preview = realPreview
    ?? (isNormalized ? { columns: [], rows: [] } : getMockPreview(file.name));

  // If preview came from real file parse, columns already start from the first data col.
  // If from mock, first column is the "#" index — skip it.
  const dataColumns = hasRealPreview ? preview.columns : preview.columns.slice(1);
  const previewRows = hasRealPreview ? preview.rows : preview.rows;
  const visibleColumns = dataColumns.filter((c) => !hiddenColumns.includes(c));
  const missingNormalizedPreview = isNormalized && !hasRealPreview;

  function toggleVisibility(col: string) {
    setHiddenColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  const toggleColumn = useCallback(
    (col: string) => {
      const next = markedColumns.includes(col)
        ? markedColumns.filter((c) => c !== col)
        : [...markedColumns, col];
      onColumnsChange(next);
      showToast(
        markedColumns.includes(col)
          ? `"${col}" desmarcada`
          : `"${col}" marcada para normalização`
      );
    },
    [markedColumns, onColumnsChange, showToast]
  );

  const downloadUrl =
    "downloadUrl" in file ? (file as NormalizedFile).downloadUrl : "#";

  return (
    <>
      {/* ── Overlay ───────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Visualizar ${file.name}`}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Scrim */}
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0, 12, 9, 0.35)",
            opacity: visible ? 1 : 0,
            transition: visible
              ? "opacity 280ms cubic-bezier(0.25, 1, 0.5, 1)"
              : "opacity 200ms cubic-bezier(0.4, 0, 0.6, 1)",
          }}
        />

        {/* Panel */}
        <div
          ref={panelRef}
          className="db-panel"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: `${drawerWidth}px`,
            maxWidth: "92vw",
            background: "var(--bg-surface)",
            boxShadow: "-16px 0 40px rgba(0, 0, 0, 0.10)",
            display: "flex",
            flexDirection: "column",
            willChange: "transform",
            transform: visible ? "translateX(0)" : "translateX(100%)",
            transition: isResizingDrawer
              ? "none"
              : visible
                ? "transform 420ms cubic-bezier(0.16, 1, 0.3, 1), width 0ms"
                : "transform 280ms cubic-bezier(0.4, 0, 0.6, 1), width 0ms",
          }}
        >
          {/* Drawer resize handle */}
          <div
            className={`db-resize-handle${isResizingDrawer ? " is-dragging" : ""}`}
            onMouseDown={onDrawerResizeStart}
          />
          {/* Header */}
          <div
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border-default)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  {isNormalized ? "Saída normalizada" : "Upload bruto"}
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    color: "var(--text-default)",
                  }}
                >
                  {file.name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {file.rows > 0 ? file.rows.toLocaleString("pt-BR") : previewRows.length} linhas · {dataColumns.length} colunas · head({previewRows.length})
                </div>
              </div>
              <button onClick={onClose} className="sb-icon-btn" aria-label="Fechar" style={{ marginTop: "-4px" }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Hint bar */}
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {isNormalized
                  ? "Saída processada. Colunas _categoria foram criadas pela camada de classificação."
                  : "Clique no título de uma coluna para marcá-la para normalização."}
              </span>
              {!isNormalized && (
                <span style={{ fontSize: "12px", color: "var(--primary-700)", fontWeight: 500 }}>
                  {markedColumns.length} marcadas
                </span>
              )}
            </div>

          </div>

          {/* Table */}
          <div
            ref={tableScrollRef}
            className="db-table-wrap"
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest("th")) return;
              const el = tableScrollRef.current!;
              dragState.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft };
              el.classList.add("is-dragging");
            }}
            onMouseMove={(e) => {
              if (!dragState.current.active) return;
              const el = tableScrollRef.current!;
              el.scrollLeft = dragState.current.scrollLeft - (e.clientX - dragState.current.startX);
            }}
            onMouseUp={() => {
              dragState.current.active = false;
              tableScrollRef.current?.classList.remove("is-dragging");
            }}
            onMouseLeave={() => {
              dragState.current.active = false;
              tableScrollRef.current?.classList.remove("is-dragging");
            }}
            onWheel={(e) => {
              if (e.deltaY === 0) return;
              e.preventDefault();
              tableScrollRef.current!.scrollLeft += e.deltaY;
            }}
          >
            {missingNormalizedPreview ? (
              <div
                style={{
                  height: "100%",
                  minHeight: "280px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "10px",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                {normalizedPreviewLoading ? (
                  <>
                    <Loader2
                      size={18}
                      strokeWidth={2}
                      style={{ color: "var(--primary-700)", animation: "spin 1s linear infinite" }}
                    />
                    <span>Lendo a planilha gerada…</span>
                  </>
                ) : (
                  <span>Prévia indisponível para a planilha gerada.</span>
                )}
              </div>
            ) : (
              <table className="db-table">
                <caption>
                  Exibindo {previewRows.length} de {file.rows > 0 ? file.rows.toLocaleString("pt-BR") : previewRows.length} linhas
                </caption>
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    {visibleColumns.map((col) => {
                      const marked = markedColumns.includes(col);
                      return (
                        <th
                          key={col}
                          className={isNormalized ? "" : marked ? "marked clickable" : "clickable"}
                          onClick={isNormalized ? undefined : () => toggleColumn(col)}
                          aria-pressed={!isNormalized ? marked : undefined}
                          title={isNormalized ? col : `${marked ? "Desmarcar" : "Marcar"} coluna "${col}"`}
                        >
                          {col}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIdx) => {
                  // Real file: row is all cells [col0, col1, ...], no leading index
                  // Mock: row[0] is "#" index, row.slice(1) are cells
                  const idx = hasRealPreview ? String(rowIdx) : row[0];
                  const cells = hasRealPreview ? row : row.slice(1);
                  return (
                    <tr key={rowIdx}>
                      <td className="col-index">{idx}</td>
                      {dataColumns.map((colName, ci) => {
                        if (hiddenColumns.includes(colName)) return null;
                        const cell = cells[ci] ?? "";
                        const isMarked = markedColumns.includes(colName);
                        let className = isMarked && !isNormalized ? "col-marked" : "";
                        if (isNull(cell)) className += " null-cell";
                        else if (hasPipe(cell)) className += " pipe-cell";
                        return (
                          <td key={ci} className={className.trim() || undefined}>
                            {isNull(cell) ? <em>null</em> : cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Control panels (below table) ─────────────────── */}
          {!isNormalized && (() => {
            const visSearchNorm = normalize(visibilitySearch).replace(/_/g, " ");
            const sortedVisCols = visibilitySortAlpha
              ? [...dataColumns].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
              : dataColumns;
            const filteredVis = visibilitySearch
              ? sortedVisCols.filter((c) => normalize(c).replace(/_/g, " ").includes(visSearchNorm))
              : sortedVisCols;

            const anyHidden = hiddenColumns.length > 0;
            const allMarked = markedColumns.length === dataColumns.length;

            const markResults = markSearch
              ? dataColumns
                  .map((c) => ({ col: c, score: matchScore(markSearch, c) }))
                  .filter((x) => x.score < 4)
                  .sort((a, b) => a.score - b.score || a.col.localeCompare(b.col))
                  .map((x) => x.col)
              : dataColumns;

            const inputStyle: React.CSSProperties = {
              width: "100%",
              boxSizing: "border-box",
              padding: "5px 8px 5px 28px",
              fontSize: "12px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              background: "var(--bg-tinted)",
              color: "var(--text-default)",
              outline: "none",
              fontFamily: "inherit",
            };

            return (
              <div style={{ borderTop: "1px solid var(--border-default)", display: "flex", flex: 1, minHeight: 0 }}>

                {/* Left: visibility filter */}
                <div style={{ flex: 1, padding: "10px 16px 10px 20px", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", gap: "6px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                      Ocultar colunas
                    </span>
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <button
                        className={`db-panel-act-btn${visibilitySortAlpha ? " is-active" : ""}`}
                        onClick={() => setVisibilitySortAlpha((v) => !v)}
                        title={visibilitySortAlpha ? "Voltar à ordem original do arquivo" : "Ordenar A–Z"}
                      >
                        A–Z
                      </button>
                      <button
                        className="db-panel-act-btn"
                        onClick={() => anyHidden ? setHiddenColumns([]) : setHiddenColumns([...dataColumns])}
                      >
                        {anyHidden ? "Mostrar tudo" : "Ocultar tudo"}
                      </button>
                    </div>
                  </div>
                  {/* Search */}
                  <div style={{ position: "relative", marginBottom: "8px", flexShrink: 0 }}>
                    <Search size={11} strokeWidth={2} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                    <input
                      value={visibilitySearch}
                      onChange={(e) => setVisibilitySearch(e.target.value)}
                      placeholder="Buscar coluna…"
                      style={inputStyle}
                    />
                  </div>
                  {/* Pills — fill remaining space, scroll when overflow */}
                  <div
                    className="scroll-styled"
                    style={{ display: "flex", flexWrap: "wrap", gap: "4px", overflowY: "auto", flex: 1, alignContent: "flex-start" }}
                  >
                    {filteredVis.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Nenhuma coluna encontrada.</span>
                    ) : filteredVis.map((col) => {
                      const hidden = hiddenColumns.includes(col);
                      return (
                        <button
                          key={col}
                          className={`db-vis-pill${hidden ? " is-hidden" : ""}`}
                          onClick={() => toggleVisibility(col)}
                          title={hidden ? `Mostrar "${col}"` : `Ocultar "${col}"`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ width: "1px", background: "var(--border-default)", margin: "10px 0", flexShrink: 0 }} />

                {/* Right: mark search */}
                <div style={{ width: "230px", flexShrink: 0, padding: "10px 20px 10px 16px", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", gap: "6px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                      Marcar
                    </span>
                    <button
                      className="db-panel-act-btn"
                      onClick={() => allMarked ? onColumnsChange([]) : onColumnsChange([...dataColumns])}
                    >
                      {allMarked ? "Desmarcar tudo" : "Marcar tudo"}
                    </button>
                  </div>
                  {/* Search */}
                  <div style={{ position: "relative", marginBottom: "6px", flexShrink: 0 }}>
                    <Search size={11} strokeWidth={2} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                    <input
                      value={markSearch}
                      onChange={(e) => setMarkSearch(e.target.value)}
                      placeholder="Buscar e marcar…"
                      style={inputStyle}
                    />
                  </div>
                  {/* Results */}
                  <div className="scroll-styled" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
                    {markResults.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", padding: "4px 0" }}>Nenhuma coluna encontrada.</span>
                    ) : markResults.map((col) => {
                      const marked = markedColumns.includes(col);
                      return (
                        <button
                          key={col}
                          onClick={() => toggleColumn(col)}
                          style={{
                            display: "flex", alignItems: "center", gap: "7px",
                            padding: "4px 6px", borderRadius: "5px",
                            background: marked ? "var(--bg-tinted)" : "transparent",
                            border: marked ? "1px solid var(--border-active)" : "1px solid transparent",
                            cursor: "pointer", textAlign: "left", width: "100%",
                            transition: "background 120ms ease, border-color 120ms ease",
                          }}
                        >
                          <div style={{
                            width: "13px", height: "13px", borderRadius: "3px", flexShrink: 0,
                            border: `1.5px solid ${marked ? "var(--border-focus)" : "var(--border-strong)"}`,
                            background: marked ? "var(--primary-700)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 120ms ease",
                          }}>
                            {marked && <span style={{ color: "white", fontSize: "9px", lineHeight: 1, fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{
                            fontSize: "12px", fontFamily: "monospace", letterSpacing: "-0.01em",
                            color: marked ? "var(--text-accent)" : "var(--text-default)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {col}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Bottom bar ───────────────────────────────────────── */}
          <div
            style={{
              borderTop: "1px solid var(--border-default)",
              padding: "12px 24px 16px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            {!isNormalized ? (
              <>
                <div style={{ fontSize: "12.5px", color: markedColumns.length > 0 ? "var(--text-secondary)" : "var(--text-muted)", minWidth: 0, overflow: "hidden" }}>
                  {markedColumns.length === 0 ? (
                    "Marque pelo menos uma coluna para normalização."
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500, flexShrink: 0 }}>Normalizar:</span>
                      {markedColumns.map((col) => (
                        <code
                          key={col}
                          style={{ fontSize: "11px", background: "var(--bg-subtle)", borderRadius: "4px", padding: "1px 5px", fontFamily: "monospace" }}
                        >
                          {col}
                        </code>
                      ))}
                    </span>
                  )}
                </div>
                <button onClick={onClose} className="btn-primary" style={{ fontSize: "13px", padding: "8px 16px", flexShrink: 0 }}>
                  Concluir
                </button>
              </>
            ) : (
              <>
                <div />
                <a
                  href={downloadUrl}
                  download
                  className="btn-primary"
                  style={{ fontSize: "13px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                >
                  <Download size={14} strokeWidth={2} aria-hidden="true" />
                  Baixar CSV
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast (portal) */}
      {toastMsg &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1b3630",
              color: "#ffffff",
              fontSize: "13px",
              padding: "10px 18px",
              borderRadius: "8px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              zIndex: 400,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {toastMsg}
          </div>,
          document.body
        )}
    </>
  );
}
