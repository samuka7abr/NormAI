/* ── Report & execution types — espelham os schemas HTTP do backend ──
 * Backend: src/presentation/http/schemas/reports.py
 * ─────────────────────────────────────────────────────────────── */

export type ExecutionStatus = "QUEUED" | "PROCESSING" | "READY" | "ERROR";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Métricas de classificação por coluna (uma entrada por coluna `classify:true`). */
export interface ClassificationColumnMetric {
  /** Categorias descobertas pela IA. Sempre inclui "Outros" no final. */
  categories: string[];
  /** Quantos valores únicos a coluna tinha (após dedup e remoção de vazios). */
  unique_values: number;
  /** Quantos receberam uma categoria válida (inclui "Outros" intencional). */
  classified_ok: number;
  /** Quantos foram forçados a "Outros" por alucinação da IA — sinal de má qualidade. */
  fell_to_others: number;
}

export interface ClassificationMetrics {
  columns: Record<string, ClassificationColumnMetric>;
}

/** Resposta do polling de status de uma execução. */
export interface ExecutionStatusData {
  id: string;
  report_id: string;
  status: ExecutionStatus;
  progress_percent: number;
  current_step: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_log: string | null;
  classification_metrics: ClassificationMetrics | null;
  created_at: string;
  updated_at: string;
}

/** Resposta do POST /projects/{id}/reports. */
export interface UploadReportResult {
  report_id: string;
  execution_id: string;
  original_filename: string;
  approval_status: ApprovalStatus;
  /** Colunas presentes no arquivo mas não configuradas — passam intactas. */
  extra_columns: string[];
}

/** Detalhe de "100% caiu em Outros" → provável falha de LLM. */
export function isLikelyLLMFailure(m: ClassificationColumnMetric): boolean {
  return m.unique_values > 0 && m.fell_to_others === m.unique_values;
}

/** Ratio de valores forçados a "Outros" (0–1). */
export function fellToOthersRatio(m: ClassificationColumnMetric): number {
  return m.unique_values > 0 ? m.fell_to_others / m.unique_values : 0;
}
