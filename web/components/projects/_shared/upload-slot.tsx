"use client";

import { useRef, useState } from "react";
import { FileText, UploadCloud, Trash2, Loader2 } from "lucide-react";
import type { UploadedFile } from "@/types/project";
import { formatSize, formatRows, formatRelativeDate } from "./format-utils";
import { parseFileInWorker } from "./parse-file";

export interface UploadSlotProps {
  file: UploadedFile | null;
  /** `raw` é o File original — necessário para enviar os bytes ao backend. */
  onUpload: (f: UploadedFile, raw: File) => void;
  onRemove?: () => void;
  onOpenDrawer?: () => void;
}

export function UploadSlot({
  file,
  onUpload,
  onRemove,
  onOpenDrawer,
}: UploadSlotProps) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    setParsing(true);
    try {
      const { columns, rows, totalRows } = await parseFileInWorker(f);
      const uploaded: UploadedFile = {
        id: Date.now().toString(),
        name: f.name,
        size: f.size,
        rows: totalRows,
        uploadedAt: new Date().toISOString(),
        preview: columns.length > 0 ? { columns, rows } : undefined,
      };
      onUpload(uploaded, f);
    } finally {
      setParsing(false);
    }
  }

  if (file) {
    return (
      <div
        className="upload-slot-card upload-slot-card-inner"
        onClick={onOpenDrawer}
        style={{
          borderRadius: "10px",
          cursor: onOpenDrawer ? "pointer" : "default",
          transition: onOpenDrawer ? "border-color 150ms ease, background 150ms ease" : undefined,
        }}
      >
        <div
          style={{
            padding: "20px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div className="upload-slot-icon-bg" style={{
            width: "44px", height: "44px", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <FileText
              size={22}
              strokeWidth={1.4}
              style={{ color: "var(--primary-700)" }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text-default)",
                letterSpacing: "-0.01em",
              }}
            >
              {file.name}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginTop: "3px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {file.rows > 0 ? `${formatRows(file.rows)} linhas · ` : null}
              {formatSize(file.size)}
              {onOpenDrawer && ` · ${formatRelativeDate(file.uploadedAt)}`}
            </div>
          </div>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="btn-row-delete"
              aria-label="Remover arquivo"
              style={{
                flexShrink: 0, background: "none", border: "none",
                cursor: "pointer", padding: "6px", color: "var(--text-muted)",
                borderRadius: "6px", display: "flex", alignItems: "center",
                lineHeight: 1,
              }}
            >
              <Trash2 size={16} strokeWidth={1.6} />
            </button>
          )}
        </div>
        <div
          className="upload-slot-footer"
          style={{ padding: "10px 20px" }}
        >
          <button
            onClick={(e) => {
              if (onOpenDrawer) e.stopPropagation();
              fileInputRef.current?.click();
            }}
            style={{
              fontSize: "12px",
              color: "var(--primary-600, oklch(48% 0.12 165))",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontWeight: 500,
            }}
          >
            Substituir arquivo
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className="upload-slot-drop"
      onClick={() => !parsing && fileInputRef.current?.click()}
      style={{
        border: `1.5px dashed ${dragOver ? "var(--primary-700)" : "var(--primary-300, oklch(80% 0.06 165))"}`,
        borderRadius: "10px",
        padding: "100px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        cursor: parsing ? "default" : "pointer",
        background: dragOver ? "rgba(0, 107, 90, 0.03)" : "transparent",
        transition: "border-color 150ms ease, background 150ms ease",
        textAlign: "center",
      }}
    >
      {parsing ? (
        <Loader2 size={32} strokeWidth={1.5} style={{ color: "var(--primary-500)", animation: "spin 1s linear infinite" }} />
      ) : (
        <UploadCloud size={36} strokeWidth={1.3} style={{ color: "var(--primary-500, oklch(55% 0.13 165))" }} />
      )}
      <span
        style={{
          fontSize: "14px",
          color: "var(--text-default)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {parsing ? "Lendo arquivo…" : "Arraste um CSV ou XLSX"}
      </span>
      {!parsing && (
      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
        ou clique para selecionar do computador
      </span>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
