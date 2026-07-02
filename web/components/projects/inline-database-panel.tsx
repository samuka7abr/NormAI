"use client";

import { Download, Table } from "lucide-react";
import type { NormalizedFile, UploadedFile } from "@/types/project";

/* ── Mock preview ────────────────────────────────────────────── */
const NULL_VALUES = new Set(["NA", "Não informado", "Não aplicável", "null", "NULL", ""]);
function isNull(v: string) { return NULL_VALUES.has(v.trim()); }
function hasPipe(v: string) { return v.includes("|") || v.includes("/"); }

type PreviewData = { columns: string[]; rows: string[][] };
function getMockPreview(fileName: string): PreviewData {
  if (fileName.includes("improbidade") || fileName.includes("normalized")) {
    return {
      columns: ["#", "réu", "cargo", "município", "valor_ressarcimento", "situação"],
      rows: [
        ["0", "JOSE SILVA SANTOS", "Prefeito Municipal", "São Paulo/SP", "R$ 120.000,00", "Condenado"],
        ["1", "Maria Oliveira", "Secretária de Saúde", "Rio de Janeiro/RJ", "NA", "Absolvido"],
        ["2", "ANA PAULA RODRIGUES", "Vereador", "Belo Horizonte/MG", "R$ 45.000,00", "Processando"],
        ["3", "Carlos|Roberto Ferreira", "Dir. Financeiro", "Curitiba/PR", "R$ 89.500,00", "Condenado"],
        ["4", "LUIZ HENRIQUE ALVES", "Prefeito Municipal", "Salvador/BA", "Não informado", "Absolvido"],
        ["5", "fernanda souza lima", "Secretário de Obras", "Fortaleza/CE", "R$ 230.000,00", "Condenado"],
        ["6", "Pedro Costa", "Vereador", "Manaus/AM", "NA", "Processando"],
        ["7", "MARCIA APARECIDA NUNES", "Prefeito Municipal", "Recife/PE", "R$ 67.000,00", "Absolvido"],
      ],
    };
  }
  return {
    columns: ["#", "acusado", "vítima", "espécie", "data_ocorrência", "delegacia"],
    rows: [
      ["0", "JOAO DA SILVA", "Cachorro", "Canina", "12/01/2024", "1ª DP - Centro"],
      ["1", "maria jose santos", "Gato/Cachorro", "Felina", "NA", "5ª DP - Norte"],
      ["2", "CARLOS ROBERTO", "Cavalo", "Equina", "23/03/2024", "3ª DP - Sul"],
      ["3", "Ana Paula", "Não informado", "Não aplicável", "15/04/2024", "2ª DP - Leste"],
      ["4", "PEDRO HENRIQUE LIMA", "Cachorro", "Canina", "02/05/2024", "1ª DP - Centro"],
      ["5", "lucia ferreira|costa", "Gato", "Felina", "18/05/2024", "4ª DP - Oeste"],
      ["6", "ROBERTO SOUZA", "Pássaro", "Silvestre", "NULL", "3ª DP - Sul"],
      ["7", "fernanda alves", "Cachorro", "Canina", "29/05/2024", "5ª DP - Norte"],
    ],
  };
}

/* ── Component ───────────────────────────────────────────────── */
export interface InlineDatabasePanelProps {
  file: UploadedFile | NormalizedFile | null;
  isNormalized: boolean;
  markedColumns: string[];
  onColumnsChange: (cols: string[]) => void;
}

export function InlineDatabasePanel({ file, isNormalized, markedColumns, onColumnsChange }: InlineDatabasePanelProps) {
  if (!file) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "40px 32px", opacity: 0.4, height: "100%" }}>
        <Table size={32} strokeWidth={1.2} style={{ color: "var(--text-muted)" }} />
        <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
          Faça upload de um arquivo para<br />visualizar o banco de dados aqui.
        </p>
      </div>
    );
  }

  const preview = (file as { preview?: { columns: string[]; rows: string[][] } }).preview
    ?? getMockPreview(file.name);
  const hasRealPreview = !!(file as { preview?: unknown }).preview;
  const dataColumns = hasRealPreview ? preview.columns : preview.columns.slice(1);
  const previewRows = hasRealPreview ? preview.rows : preview.rows;
  const downloadUrl = "downloadUrl" in file ? (file as NormalizedFile).downloadUrl : "#";

  function toggleColumn(col: string) {
    const next = markedColumns.includes(col)
      ? markedColumns.filter((c) => c !== col)
      : [...markedColumns, col];
    onColumnsChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "4px" }}>
          {isNormalized ? "Saída normalizada" : "Upload bruto"}
        </div>
        <div style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file.name}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
          {file.rows > 0 ? file.rows.toLocaleString("pt-BR") : previewRows.length} linhas · {dataColumns.length} colunas · head({previewRows.length})
        </div>
        <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-muted)" }}>
          {isNormalized
            ? "Saída processada. Colunas _categoria foram criadas pela camada de classificação."
            : `Clique no título de uma coluna para marcá-la. ${markedColumns.length} marcadas.`}
        </div>
      </div>

      {/* Table */}
      <div className="db-table-wrap" style={{ flex: 1, overflow: "auto" }}>
        <table className="db-table">
          <caption>Exibindo {previewRows.length} de {file.rows > 0 ? file.rows.toLocaleString("pt-BR") : previewRows.length} linhas</caption>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>#</th>
              {dataColumns.map((col) => {
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
              const idx = hasRealPreview ? String(rowIdx) : row[0];
              const cells = hasRealPreview ? row : row.slice(1);
              return (
                <tr key={idx}>
                  <td className="col-index">{idx}</td>
                  {dataColumns.map((colName, ci) => {
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
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border-default)", padding: "14px 24px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {!isNormalized ? (
          <div style={{ fontSize: "13px", color: markedColumns.length > 0 ? "var(--text-secondary)" : "var(--text-muted)" }}>
            {markedColumns.length === 0 ? "Marque pelo menos uma coluna." : (
              <><span style={{ fontWeight: 500 }}>Normalizar:</span>{" "}{markedColumns.map((col) => (
                <code key={col} style={{ fontSize: "11.5px", background: "var(--bg-subtle)", borderRadius: "4px", padding: "2px 5px", marginRight: "4px", fontFamily: "monospace" }}>{col}</code>
              ))}</>
            )}
          </div>
        ) : (
          <>
            <div />
            <a href={downloadUrl} download className="btn-primary" style={{ fontSize: "13px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
              <Download size={14} strokeWidth={2} aria-hidden="true" />
              Baixar CSV
            </a>
          </>
        )}
      </div>
    </div>
  );
}
