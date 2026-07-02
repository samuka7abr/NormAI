import axios from "axios";
import api from "./api";
import type { ExecutionStatusData, UploadReportResult } from "@/types/report";

/**
 * Lançada quando o backend recusa o upload porque o arquivo não contém todas
 * as colunas configuradas (HTTP 409). `missing` são colunas habilitadas na
 * config que faltam no arquivo; `extra` são colunas do arquivo sem config.
 */
export class ColumnsMismatchError extends Error {
  missing: string[];
  extra: string[];
  constructor(missing: string[], extra: string[]) {
    super(
      missing.length
        ? `O arquivo não contém as colunas configuradas: ${missing.join(", ")}`
        : "Colunas do arquivo não batem com a configuração."
    );
    this.name = "ColumnsMismatchError";
    this.missing = missing;
    this.extra = extra;
  }
}

/**
 * Faz upload de um relatório (CSV/XLSX). Cria a execução em QUEUED e enfileira
 * o processamento (normalização + classificação por IA) no backend.
 *
 * @throws ColumnsMismatchError em 409.
 */
export async function uploadReport(
  projectId: string,
  file: File
): Promise<UploadReportResult> {
  const form = new FormData();
  form.append("file", file);
  try {
    const { data } = await api.post<UploadReportResult>(
      `/projects/${projectId}/reports`,
      form
    );
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      const detail = err.response.data?.detail ?? {};
      throw new ColumnsMismatchError(
        detail.missing_columns ?? [],
        detail.extra_columns ?? []
      );
    }
    throw err;
  }
}

/** Polling de status de uma execução (inclui classification_metrics quando READY). */
export async function getExecutionStatus(
  reportId: string,
  executionId: string,
  projectId: string
): Promise<ExecutionStatusData> {
  const { data } = await api.get<ExecutionStatusData>(
    `/reports/${reportId}/executions/${executionId}/status`,
    { params: { project_id: projectId } }
  );
  return data;
}

/** Devolve uma presigned URL (de vida curta) pra baixar o resultado. */
export async function getDownloadUrl(
  reportId: string,
  executionId: string,
  projectId: string
): Promise<string> {
  const { data } = await api.get<{ download_url: string }>(
    `/reports/${reportId}/executions/${executionId}/download`,
    { params: { project_id: projectId } }
  );
  return data.download_url;
}

/** Baixa o arquivo processado via proxy interno para leitura no frontend. */
export async function getDownloadBlob(
  reportId: string,
  executionId: string,
  projectId: string
): Promise<Blob> {
  const params = new URLSearchParams({ executionId, raw: "1" });
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(reportId)}/download?${params}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo processado.");
  return res.blob();
}

/** Cria uma nova execução reaproveitando o arquivo original já no backend. */
export async function reprocessReport(
  reportId: string,
  projectId: string
): Promise<ExecutionStatusData> {
  const { data } = await api.post<ExecutionStatusData>(
    `/reports/${reportId}/reprocess`,
    null,
    { params: { project_id: projectId } }
  );
  return data;
}
