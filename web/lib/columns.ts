import api from "./api";
import type { ColumnConfig, ColumnConfigInput, DetectedColumn } from "@/types/config";
import type { ColumnProcessingConfigMap, NormalizationType } from "@/types/project";

/* ── Mapa: id de normalização do front → chave que o backend reconhece ──
 * Backend: src/infrastructure/processor/normalization_processor.py (_enabled)
 * Atenção: "suffixes" / "accents" / "capitalize" NÃO são reconhecidos
 * diretamente — precisam ser traduzidos pras chaves canônicas abaixo.
 * ─────────────────────────────────────────────────────────────── */
const NORM_KEY_MAP: Record<NormalizationType, string> = {
  trim: "trim",
  nulls: "nulls",
  split: "split",
  suffixes: "remove_suffixes",
  abbreviate: "abbreviate",
  accents: "remove_accents",
  capitalize: "capitalize_pt_br",
};

/** Converte a lista de tipos selecionados no front no dict que o backend espera. */
export function buildNormalizationsDict(
  types: NormalizationType[]
): Record<string, boolean> {
  const dict: Record<string, boolean> = {};
  for (const t of types) {
    const key = NORM_KEY_MAP[t];
    if (key) dict[key] = true;
  }
  return dict;
}

export interface BuildColumnConfigsParams {
  /** Colunas configuradas no front. */
  columns?: string[];
  /** Configuração individual por coluna. */
  columnConfigs?: ColumnProcessingConfigMap;
  /** Colunas marcadas para normalização (nomes reais do arquivo). */
  columnsToNormalize?: string[];
  /** Tipos de normalização aplicados (globais a todas as colunas marcadas). */
  normalizationTypes?: NormalizationType[];
  /** Colunas marcadas para classificação por IA. */
  columnsToClassify?: string[];
  /** Amostras por coluna, quando disponíveis (do detect ou do preview). */
  samplesByColumn?: Record<string, string[]>;
}

/**
 * Monta o corpo do PUT /columns a partir do estado de config do front.
 *
 * Regras:
 *  - `enabled: true` em qualquer coluna configurada (o backend exige que toda
 *    coluna habilitada exista no arquivo enviado, senão devolve 409).
 *  - Coluna normalizada → recebe o dict de normalizações.
 *  - Coluna só classificada → normalizations vazio, classify true.
 */
export function buildColumnConfigs(
  params: BuildColumnConfigsParams
): ColumnConfigInput[] {
  const {
    columns = [],
    columnConfigs,
    columnsToNormalize = [],
    normalizationTypes = [],
    columnsToClassify = [],
  } = params;
  const samples = params.samplesByColumn ?? {};

  if (columnConfigs) {
    const allColumns = Array.from(
      new Set([...columns, ...Object.keys(columnConfigs)])
    );
    return allColumns.map((column) => {
      const config = columnConfigs[column] ?? {
        normalizationTypes: [],
        classify: false,
      };
      return {
        column_name: column,
        enabled: true,
        normalizations: buildNormalizationsDict(config.normalizationTypes),
        classify: config.classify,
        categories: null,
        sample_values: samples[column] ?? [],
      };
    });
  }

  const normDict = buildNormalizationsDict(normalizationTypes);
  const allColumns = Array.from(
    new Set([...columnsToNormalize, ...columnsToClassify])
  );
  return allColumns.map((column) => {
    const isNormalized = columnsToNormalize.includes(column);
    const isClassified = columnsToClassify.includes(column);
    return {
      column_name: column,
      enabled: true,
      normalizations: isNormalized ? { ...normDict } : {},
      classify: isClassified,
      categories: null,
      sample_values: samples[column] ?? [],
    };
  });
}

/* ── API ─────────────────────────────────────────────────────── */

/** Detecta as colunas de um arquivo sem persistir nada. */
export async function detectColumns(
  projectId: string,
  file: File
): Promise<DetectedColumn[]> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<DetectedColumn[]>(
    `/projects/${projectId}/columns/detect`,
    form
  );
  return data;
}

/** Lista as configs de coluna persistidas do projeto. */
export async function getColumns(projectId: string): Promise<ColumnConfig[]> {
  const { data } = await api.get<ColumnConfig[]>(`/projects/${projectId}/columns`);
  return data;
}

/** Substitui todas as configs de coluna do projeto (idempotente). */
export async function putColumns(
  projectId: string,
  configs: ColumnConfigInput[]
): Promise<ColumnConfig[]> {
  const { data } = await api.put<ColumnConfig[]>(
    `/projects/${projectId}/columns`,
    configs
  );
  return data;
}
