export type NormalizationType =
  | "trim"
  | "nulls"
  | "split"
  | "suffixes"
  | "abbreviate"
  | "accents"
  | "capitalize";

export interface ColumnProcessingConfig {
  normalizationTypes: NormalizationType[];
  classify: boolean;
}

export type ColumnProcessingConfigMap = Record<string, ColumnProcessingConfig>;

export interface Project {
  id: string;
  title: string;
  description: string;
  aiContext: string;
  tasks: {
    normalize: boolean;
    classify: boolean;
  };
  columnsToNormalize: string[];
  normalizationTypes?: NormalizationType[];
  columnsToClassify: string[];
  columnConfigs?: ColumnProcessingConfigMap;
  normalizations: number;
  classifications: number;
  lastRun: string | null;   // ISO 8601
  createdAt: string;        // ISO 8601
  uploadedFile: UploadedFile | null;
  normalizedFile: NormalizedFile | null;
  hasError?: boolean;
  /**
   * SIMULAÇÃO — removido quando backend expor status no GET /projects/{id}.
   * Representa o estado intermediário de processamento persistido localmente.
   */
  processStatus?: "processing" | "paused" | null;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;             // bytes
  rows: number;
  uploadedAt: string;       // ISO 8601
  preview?: FilePreview;
}

export interface NormalizedFile {
  id: string;
  name: string;             // backend usa "normalized_<original>"
  size: number;
  rows: number;
  generatedAt: string;
  downloadUrl: string;
  preview?: FilePreview;
}

export interface FilePreview {
  columns: string[];
  rows: string[][];
}
