/* ── Column-config types — espelham os schemas HTTP do backend ──
 * Backend: src/presentation/http/schemas/column_configs.py
 * ─────────────────────────────────────────────────────────────── */

/** Resultado do POST /projects/{id}/columns/detect (não persiste). */
export interface DetectedColumn {
  column_name: string;
  sample_values: string[];
}

/** Corpo de uma entrada no PUT /projects/{id}/columns. */
export interface ColumnConfigInput {
  column_name: string;
  enabled: boolean;
  /** Dict de normalizações no formato do backend (ex: { trim: true, abbreviate: true }). */
  normalizations: Record<string, boolean>;
  classify: boolean;
  categories: string[] | null;
  sample_values: string[];
}

/** Resposta persistida do PUT/GET /projects/{id}/columns. */
export interface ColumnConfig extends ColumnConfigInput {
  id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}
