"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import type {
  ClassificationColumnMetric,
  ClassificationMetrics,
} from "@/types/report";
import { fellToOthersRatio, isLikelyLLMFailure } from "@/types/report";

const WARN_RATIO = 0.15;

/* ── Cor do ratio de "Outros" — verde / âmbar / vermelho ──────── */
function ratioColor(metric: ClassificationColumnMetric): string {
  if (isLikelyLLMFailure(metric)) return "#ef4444";
  return fellToOthersRatio(metric) > WARN_RATIO ? "#ca8a04" : "var(--primary-700)";
}

function CategoryChip({ label }: { label: string }) {
  const isOthers = label.toLowerCase() === "outros";
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: "6px",
        background: isOthers
          ? "var(--bg-subtle)"
          : "color-mix(in oklch, var(--primary-700, oklch(38% 0.12 165)) 8%, transparent)",
        color: isOthers ? "var(--text-muted)" : "var(--primary-700, oklch(38% 0.12 165))",
        fontSize: "12px",
        fontFamily: "monospace",
        fontWeight: 500,
        border: isOthers
          ? "1px dashed var(--border-default)"
          : "1px solid color-mix(in oklch, var(--primary-700, oklch(38% 0.12 165)) 22%, transparent)",
        lineHeight: 1.5,
      }}
    >
      {label}
    </span>
  );
}

function ColumnCard({
  column,
  metric,
}: {
  column: string;
  metric: ClassificationColumnMetric;
}) {
  const ratio = fellToOthersRatio(metric);
  const pct = Math.round(ratio * 100);
  const color = ratioColor(metric);
  const failed = isLikelyLLMFailure(metric);

  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "10px",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Header: coluna → coluna gerada */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <code
          style={{
            fontSize: "12px",
            fontFamily: "monospace",
            fontWeight: 600,
            color: "var(--text-default)",
            background: "var(--bg-subtle)",
            borderRadius: "4px",
            padding: "2px 6px",
          }}
        >
          {column}
        </code>
        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>→</span>
        <code
          style={{
            fontSize: "12px",
            fontFamily: "monospace",
            fontWeight: 600,
            color: "var(--primary-700)",
            background:
              "color-mix(in oklch, var(--primary-700, oklch(38% 0.12 165)) 8%, transparent)",
            borderRadius: "4px",
            padding: "2px 6px",
          }}
        >
          {column}_categoria
        </code>
      </div>

      {/* Chips de categorias */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {metric.categories.map((c) => (
          <CategoryChip key={c} label={c} />
        ))}
      </div>

      {/* Contagens */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "18px",
          fontSize: "12.5px",
          color: "var(--text-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>
          <strong style={{ color: "var(--text-default)" }}>{metric.unique_values}</strong>{" "}
          valores únicos
        </span>
        <span>
          <strong style={{ color: "var(--text-default)" }}>{metric.classified_ok}</strong>{" "}
          classificados
        </span>
        <span style={{ marginLeft: "auto", color }}>
          {metric.fell_to_others} em &ldquo;Outros&rdquo; ({pct}%)
        </span>
      </div>

      {/* Barra de ratio */}
      <div
        style={{
          height: "4px",
          borderRadius: "2px",
          background: "var(--bg-subtle)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.max(pct, ratio > 0 ? 2 : 0)}%`,
            borderRadius: "2px",
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>

      {/* Aviso de provável falha de LLM */}
      {failed && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "9px 11px",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
          }}
        >
          <AlertTriangle
            size={14}
            strokeWidth={2}
            style={{ color: "#ef4444", flexShrink: 0, marginTop: "1px" }}
          />
          <span style={{ fontSize: "12px", color: "#b91c1c", lineHeight: 1.45 }}>
            100% dos valores caíram em &ldquo;Outros&rdquo; — provável falha da IA
            nesta execução. Confira o contexto da IA e reprocesse.
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Componente principal ─────────────────────────────────────── */
export function ClassificationMetricsPanel({
  metrics,
}: {
  metrics: ClassificationMetrics | null | undefined;
}) {
  const entries = metrics ? Object.entries(metrics.columns) : [];
  if (entries.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--text-muted)",
        }}
      >
        <Sparkles size={12} strokeWidth={2} style={{ color: "var(--primary-700)" }} />
        Classificação por IA
      </div>

      {entries.map(([column, metric]) => (
        <ColumnCard key={column} column={column} metric={metric} />
      ))}
    </div>
  );
}
