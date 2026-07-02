"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  Trash2,
  Play,
  Loader2,
  Check,
  Save,
  Sparkles,
  Clock,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import axios from "axios";
import { useProject } from "@/hooks/use-project";
import { useActivities } from "@/hooks/use-activities";
import {
  patchLocalProjectData,
  getLocalProjectData,
} from "@/lib/projects";
import { consumePendingProjectUpload } from "@/lib/pending-upload";
import { putColumns, buildColumnConfigs } from "@/lib/columns";
import {
  uploadReport,
  reprocessReport,
  getDownloadBlob,
  ColumnsMismatchError,
} from "@/lib/reports";
import { useExecutionPolling } from "@/hooks/use-report";
import { ClassificationMetricsPanel } from "@/components/reports/classification-metrics";
import { DatabaseDrawer } from "./database-drawer";
import { ConfigDrawer } from "./config-drawer";
import { ProjectLoadingSkeleton } from "./project-loading-skeleton";
import { ProjectErrorPage } from "./project-error-page";
import { ProjectField } from "./_shared/project-field";
import { UploadSlot } from "./_shared/upload-slot";
import { StatusDot } from "./_shared/status-dot";
import {
  formatSize,
  formatRows,
  formatRelativeDate,
} from "./_shared/format-utils";
import { parseFileInWorker } from "./_shared/parse-file";
import { useToast } from "@/components/ui/toast";
import { ACTIVITY_CONFIG } from "@/lib/activity-data";
import type { UploadedFile, NormalizedFile, NormalizationType } from "@/types/project";
import type { ColumnProcessingConfigMap } from "@/types/project";
import type { ClassificationMetrics, ExecutionStatusData } from "@/types/report";

/* ── Coleta amostras de cada coluna a partir do preview parseado ──
 * Vai como `sample_values` no PUT /columns (best-effort; o backend
 * relê o arquivo completo de qualquer forma).
 * ─────────────────────────────────────────────────────────────── */
function buildSamplesFromPreview(
  file: UploadedFile | null,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const preview = file?.preview;
  if (!preview) return out;
  preview.columns.forEach((col, i) => {
    const vals = preview.rows
      .map((r) => r[i])
      .filter((v) => v != null && String(v).trim() !== "")
      .slice(0, 20);
    if (vals.length) out[col] = vals;
  });
  return out;
}

function buildLegacyColumnConfigMap(
  columnsToNormalize: string[],
  normalizationTypes: NormalizationType[],
  columnsToClassify: string[],
): ColumnProcessingConfigMap {
  const columns = Array.from(new Set([...columnsToNormalize, ...columnsToClassify]));
  return Object.fromEntries(
    columns.map((column) => [
      column,
      {
        normalizationTypes: columnsToNormalize.includes(column) ? normalizationTypes : [],
        classify: columnsToClassify.includes(column),
      },
    ]),
  );
}

function columnsWithNormalizations(configs: ColumnProcessingConfigMap): string[] {
  return Object.entries(configs)
    .filter(([, config]) => config.normalizationTypes.length > 0)
    .map(([column]) => column);
}

function columnsWithClassification(configs: ColumnProcessingConfigMap): string[] {
  return Object.entries(configs)
    .filter(([, config]) => config.classify)
    .map(([column]) => column);
}

function configuredColumns(configs: ColumnProcessingConfigMap): string[] {
  return Object.entries(configs)
    .filter(([, config]) => config.classify || config.normalizationTypes.length > 0)
    .map(([column]) => column);
}

function syncColumnConfigKeys(
  columns: string[],
  configs: ColumnProcessingConfigMap,
): ColumnProcessingConfigMap {
  return Object.fromEntries(
    columns.map((column) => [
      column,
      configs[column] ?? { normalizationTypes: [], classify: false },
    ]),
  );
}

function resultFileName(originalName?: string): string {
  if (!originalName) return "normalized_resultado.csv";
  return originalName.startsWith("normalized_")
    ? originalName
    : `normalized_${originalName}`;
}

/* ── CSV preview helpers ─────────────────────────────────────────
 * TODO (backend): replace getMockPreview with a real API call.
 * Endpoint: GET /api/projects/{id}/file-preview?type=upload|normalized
 * Expected response: { columns: string[]; rows: string[][] }
 * ─────────────────────────────────────────────────────────────── */
const PREVIEW_ROWS = 10;
const NULL_VALUES = new Set([
  "NA",
  "Não informado",
  "Não aplicável",
  "null",
  "NULL",
  "",
]);
function isNull(v: string) {
  return NULL_VALUES.has(v.trim());
}
function hasPipe(v: string) {
  return v.includes("|") || v.includes("/");
}

type PreviewData = { columns: string[]; rows: string[][] };

function getMockPreview(fileName: string): PreviewData {
  if (fileName.includes("improbidade") || fileName.includes("normalized")) {
    return {
      columns: [
        "#",
        "réu",
        "réu_normalizado",
        "cargo",
        "cargo_categoria",
        "município",
        "uf",
        "tribunal",
        "situação",
      ],
      rows: [
        [
          "0",
          "JOSE SILVA SANTOS",
          "José Silva Santos",
          "Prefeito Municipal",
          "Executivo Municipal",
          "São Paulo",
          "SP",
          "TJSP",
          "Condenado",
        ],
        [
          "1",
          "Maria Oliveira",
          "Maria Oliveira",
          "Secretária de Saúde",
          "Executivo Municipal",
          "Rio de Janeiro",
          "RJ",
          "TJRJ",
          "Absolvido",
        ],
        [
          "2",
          "ANA PAULA RODRIGUES",
          "Ana Paula Rodrigues",
          "Vereador",
          "Legislativo Municipal",
          "Belo Horizonte",
          "MG",
          "TJMG",
          "Processando",
        ],
        [
          "3",
          "Carlos|Roberto Ferreira",
          "Carlos Roberto Ferreira",
          "Dir. Financeiro",
          "Administração Direta",
          "Curitiba",
          "PR",
          "TJPR",
          "Condenado",
        ],
        [
          "4",
          "LUIZ HENRIQUE ALVES",
          "Luiz Henrique Alves",
          "Prefeito Municipal",
          "Executivo Municipal",
          "Salvador",
          "BA",
          "TJBA",
          "Absolvido",
        ],
        [
          "5",
          "fernanda souza lima",
          "Fernanda Souza Lima",
          "Secretário de Obras",
          "Executivo Municipal",
          "Fortaleza",
          "CE",
          "TJCE",
          "Condenado",
        ],
        [
          "6",
          "Pedro Costa",
          "Pedro Costa",
          "Vereador",
          "Legislativo Municipal",
          "Manaus",
          "AM",
          "TJAM",
          "Processando",
        ],
        [
          "7",
          "MARCIA APARECIDA NUNES",
          "Márcia Aparecida Nunes",
          "Prefeito Municipal",
          "Executivo Municipal",
          "Recife",
          "PE",
          "TJPE",
          "Absolvido",
        ],
        [
          "8",
          "ROBERTO SOUZA LIMA",
          "Roberto Souza Lima",
          "Diretor",
          "Administração Direta",
          "Goiânia",
          "GO",
          "TJGO",
          "Condenado",
        ],
        [
          "9",
          "Lucia Ferreira",
          "Lúcia Ferreira",
          "Secretária",
          "Executivo Municipal",
          "Maceió",
          "AL",
          "TJAL",
          "Absolvido",
        ],
      ],
    };
  }
  return {
    columns: [
      "#",
      "acusado",
      "acusado_normalizado",
      "vítima",
      "espécie",
      "espécie_categoria",
      "data_ocorrência",
      "município",
      "tipo_maus_tratos",
      "situação_animal",
    ],
    rows: [
      [
        "0",
        "JOAO DA SILVA",
        "João da Silva",
        "Cachorro",
        "Canina",
        "cao",
        "12/01/2024",
        "São Paulo",
        "Abandono",
        "Resgatado",
      ],
      [
        "1",
        "maria jose santos",
        "Maria José Santos",
        "Gato/Cachorro",
        "Felina",
        "gato",
        "NA",
        "Campinas",
        "Maus tratos físicos",
        "Óbito",
      ],
      [
        "2",
        "CARLOS ROBERTO",
        "Carlos Roberto",
        "Cavalo",
        "Equina",
        "equino",
        "23/03/2024",
        "Ribeirão Preto",
        "Negligência",
        "Tratamento",
      ],
      [
        "3",
        "Ana Paula",
        "Ana Paula",
        "Não informado",
        "Não aplicável",
        "NULL",
        "15/04/2024",
        "Santos",
        "Abandono",
        "Não localizado",
      ],
      [
        "4",
        "PEDRO HENRIQUE LIMA",
        "Pedro Henrique Lima",
        "Cachorro",
        "Canina",
        "cao",
        "02/05/2024",
        "São Paulo",
        "Maus tratos físicos",
        "Resgatado",
      ],
      [
        "5",
        "lucia ferreira|costa",
        "Lúcia Ferreira Costa",
        "Gato",
        "Felina",
        "gato",
        "18/05/2024",
        "Guarulhos",
        "Negligência",
        "Tratamento",
      ],
      [
        "6",
        "ROBERTO SOUZA",
        "Roberto Souza",
        "Pássaro",
        "Silvestre",
        "ave_silvestre",
        "NULL",
        "Osasco",
        "Tráfico",
        "Apreendido",
      ],
      [
        "7",
        "fernanda alves",
        "Fernanda Alves",
        "Cachorro",
        "Canina",
        "cao",
        "29/05/2024",
        "São Bernardo",
        "Maus tratos físicos",
        "Resgatado",
      ],
      [
        "8",
        "João Silva",
        "João Silva",
        "Gato",
        "Felina",
        "gato",
        "03/06/2024",
        "Sorocaba",
        "Abandono",
        "Abrigo",
      ],
      [
        "9",
        "CARLA MATOS",
        "Carla Matos",
        "Cavalo",
        "Equina",
        "equino",
        "10/06/2024",
        "Campinas",
        "Negligência",
        "Tratamento",
      ],
    ],
  };
}


/* ── Helpers ─────────────────────────────────────────────────── */
function ColHeading({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <h2
      style={{
        margin: "0 0 20px",
        fontSize: "20px",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: color ?? "var(--text-default)",
        fontFamily: "var(--font-space-grotesk)",
      }}
    >
      {children}
    </h2>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "var(--text-muted)",
        marginBottom: "12px",
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--primary-700)",
        marginBottom: "10px",
      }}
    >
      {children}
    </div>
  );
}

/* ── Not found ────────────────────────────────────────────────── */
function ProjectNotFound() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "320px" }}>
        <p
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--text-default)",
            margin: "0 0 8px",
          }}
        >
          Projeto não encontrado
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            margin: "0 0 24px",
          }}
        >
          O projeto que você está procurando não existe ou foi deletado.
        </p>
        <Link href="/projects" className="btn-primary">
          Voltar para Projetos
        </Link>
      </div>
    </div>
  );
}

/* ── Process types ────────────────────────────────────────────── */
type RowProcessStatus = "idle" | "processing" | "paused" | "done" | "error";
type IconPhase = "play" | "check" | "check-exit";

/* ── Main component ───────────────────────────────────────────── */
export function ProjectPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { project, loading, error, update, remove } = useProject(projectId);
  const { show: showToast } = useToast();
  const { activities } = useActivities(20);
  const latestActivity = activities.find((a) => a.project_id === projectId);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleInitializedRef = useRef(false);

  /* Editable fields */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiContext, setAiContext] = useState("");

  /* File state */
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [normalizedFile, setNormalizedFile] = useState<NormalizedFile | null>(
    null,
  );

  /* Column config */
  const [markedColumns, setMarkedColumns] = useState<string[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<ColumnProcessingConfigMap>({});

  /* CSV viewer — which file is shown in the drawer */
  const [activeView, setActiveView] = useState<"upload" | "normalized">(
    "upload",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  /* Dirty tracking — snapshot of values at last save/load */
  const [savedSnapshot, setSavedSnapshot] = useState<{
    title: string;
    description: string;
    aiContext: string;
    uploadedFileId: string | null;
  } | null>(null);

  /* Save/delete UI */
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  /* Process state */
  const [rowStatus, setRowStatus] = useState<RowProcessStatus>("idle");
  const [processProgress, setProcessProgress] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const [iconPhase, setIconPhase] = useState<IconPhase>("play");
  const iconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Real backend execution state */
  const uploadedRawRef = useRef<File | null>(null);
  const normalizedPreviewPromiseRef = useRef<Promise<void> | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ClassificationMetrics | null>(null);
  const [normalizedPreviewLoading, setNormalizedPreviewLoading] = useState(false);

  /* Initialize state from project */
  useEffect(() => {
    if (project && !titleInitializedRef.current) {
      titleInitializedRef.current = true;
      setTitle(project.title);
      setDescription(project.description);
      setAiContext(project.aiContext);
      setUploadedFile(project.uploadedFile);
      setNormalizedFile(project.normalizedFile);
      const local = getLocalProjectData(projectId);
      const pendingUpload = consumePendingProjectUpload(projectId);
      if (pendingUpload) uploadedRawRef.current = pendingUpload;
      const initialColumnConfigs = project.columnConfigs ?? local.columnConfigs ?? buildLegacyColumnConfigMap(
        project.columnsToNormalize,
        project.normalizationTypes ?? [],
        project.columnsToClassify ?? [],
      );
      const initialColumns = Object.keys(initialColumnConfigs).length
        ? Object.keys(initialColumnConfigs)
        : project.columnsToNormalize;
      setMarkedColumns(initialColumns);
      setColumnConfigs(syncColumnConfigKeys(initialColumns, initialColumnConfigs));
      setReportId(local.reportId ?? null);
      setExecutionId(local.executionId ?? null);
      setMetrics(local.classificationMetrics ?? null);
      setSavedSnapshot({
        title: project.title,
        description: project.description,
        aiContext: project.aiContext,
        uploadedFileId: project.uploadedFile?.id ?? null,
      });
      if (project.normalizedFile) {
        setRowStatus("done");
        setActiveView("normalized");
      } else if (project.processStatus === "processing") {
        setRowStatus("processing");
      } else if (project.processStatus === "paused") {
        setRowStatus("paused");
      } else if (latestActivity?.type === "processing_start") {
        setRowStatus("processing");
      } else if (latestActivity?.type === "needs_action") {
        setRowStatus("error");
      }
      if (titleRef.current) titleRef.current.textContent = project.title;
    }
  }, [project]);

  /* Sync if project data updates externally — activities fill the gap when
   * processStatus isn't in localStorage (e.g. direct link, second tab).
   * Só age enquanto o estado ainda é inicial ("idle"): uma vez que o fluxo
   * real (polling/upload) assumiu o controle, não sobrescreve. */
  useEffect(() => {
    if (!project || rowStatus !== "idle") return;
    if (project.normalizedFile) setRowStatus("done");
    else if (project.processStatus === "processing") setRowStatus("processing");
    else if (latestActivity?.type === "processing_start") setRowStatus("processing");
    else if (latestActivity?.type === "needs_action") setRowStatus("error");
  }, [project, latestActivity, rowStatus]);

  /* Auto-switch CSV view when processing completes */
  useEffect(() => {
    if (rowStatus === "done" && normalizedFile) setActiveView("normalized");
  }, [rowStatus, normalizedFile]);

  /* Cleanup timers */
  useEffect(() => {
    return () => {
      clearTimeout(iconTimerRef.current!);
    };
  }, []);

  /* Redirect on 404 */
  useEffect(() => {
    if (!error) return;
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      localStorage.removeItem("last-project-id");
      router.replace("/projects");
    }
  }, [error, router]);

  /* ── Config validation ──────────────────────────────────────── */
  function getConfigIssues(): string[] {
    const issues: string[] = [];
    if (!uploadedFile) issues.push("CSV não carregado no projeto");
    const configured = configuredColumns(columnConfigs);
    if (configured.length === 0)
      issues.push("Nenhuma coluna marcada para normalizar ou classificar");
    const emptyColumns = markedColumns.filter((column) => {
      const config = columnConfigs[column];
      return !config || (!config.classify && config.normalizationTypes.length === 0);
    });
    if (emptyColumns.length > 0) {
      issues.push(`Configure normalização ou classificação em: ${emptyColumns.join(", ")}`);
    }
    return issues;
  }

  /* Persiste a config de colunas (normalização + classificação) no backend.
   * O backend tira um snapshot dela no upload/reprocess. */
  async function persistColumns(): Promise<void> {
    const configs = buildColumnConfigs({
      columns: markedColumns,
      columnConfigs,
      samplesByColumn: buildSamplesFromPreview(uploadedFile),
    });
    await putColumns(projectId, configs);
  }

  async function hydrateNormalizedPreview(
    baseFile: NormalizedFile,
    ids: { reportId: string | null; executionId: string | null },
  ): Promise<void> {
    if (baseFile.preview || !ids.reportId || !ids.executionId) return;
    if (normalizedPreviewPromiseRef.current) return normalizedPreviewPromiseRef.current;

    const hydratedReportId = ids.reportId;
    const hydratedExecutionId = ids.executionId;
    const promise = (async () => {
      setNormalizedPreviewLoading(true);
      try {
        const blob = await getDownloadBlob(hydratedReportId, hydratedExecutionId, projectId);
        const parsed = await parseFileInWorker(
          new File([blob], baseFile.name, { type: blob.type }),
        );
        const hydratedFile: NormalizedFile = {
          ...baseFile,
          size: blob.size || baseFile.size,
          rows: parsed.totalRows,
          preview: parsed.columns.length > 0
            ? { columns: parsed.columns, rows: parsed.rows }
            : undefined,
        };

        setNormalizedFile((current) =>
          current?.id === baseFile.id ? hydratedFile : current,
        );
        patchLocalProjectData(projectId, { normalizedFile: hydratedFile });
      } catch {
        showToast("Resultado gerado, mas a prévia não pôde ser carregada.", {
          duration: 3500,
        });
      } finally {
        setNormalizedPreviewLoading(false);
        normalizedPreviewPromiseRef.current = null;
      }
    })();

    normalizedPreviewPromiseRef.current = promise;
    return promise;
  }

  function openNormalizedDrawer(): void {
    if (!normalizedFile) return;
    setActiveView("normalized");
    setDrawerOpen(true);
    void hydrateNormalizedPreview(normalizedFile, { reportId, executionId });
  }

  /* ── Execução concluída (READY / ERROR) ─────────────────────── */
  function handleExecutionTerminal(data: ExecutionStatusData) {
    if (data.status === "READY") {
      const newFile: NormalizedFile = {
        id: data.id,
        name: resultFileName(uploadedFile?.name),
        size: uploadedFile?.size ?? 0,
        rows: uploadedFile?.rows ?? 0,
        generatedAt: data.finished_at ?? new Date().toISOString(),
        downloadUrl: "#", // baixado sob demanda — presigned URL de vida curta
      };
      setNormalizedFile(newFile);
      setMetrics(data.classification_metrics);
      setProcessProgress(100);
      setRowStatus("done");
      setJustCompleted(true);
      setIconPhase("check");
      patchLocalProjectData(projectId, {
        normalizedFile: newFile,
        classificationMetrics: data.classification_metrics ?? null,
        processStatus: null,
      });
      void hydrateNormalizedPreview(newFile, { reportId: data.report_id, executionId: data.id });
      iconTimerRef.current = setTimeout(() => {
        setIconPhase("check-exit");
        setTimeout(() => setIconPhase("play"), 180);
      }, 2400);
    } else {
      setRowStatus("error");
      patchLocalProjectData(projectId, { processStatus: null });
      showToast("Falha no processamento", {
        issues: [data.error_log?.slice(0, 240) || "Erro desconhecido na execução."],
        duration: 6000,
      });
    }
  }

  /* Polling da execução real — sobrevive a reload (usa ids persistidos). */
  const pollEnabled = rowStatus === "processing" && !!reportId && !!executionId;
  const { data: execData } = useExecutionPolling({
    reportId,
    executionId,
    projectId,
    enabled: pollEnabled,
    onTerminal: handleExecutionTerminal,
  });

  /* Mantém a barra de progresso em sincronia com o backend. */
  useEffect(() => {
    if (execData && execData.status !== "READY") {
      setProcessProgress(execData.progress_percent);
    }
  }, [execData]);

  function reportProcessError(err: unknown) {
    if (err instanceof ColumnsMismatchError) {
      showToast("Arquivo incompatível com a configuração", {
        issues: err.missing.map((c) => `Coluna ausente no arquivo: ${c}`),
        duration: 6000,
      });
      return;
    }
    const detail =
      axios.isAxiosError(err) && typeof err.response?.data?.detail === "string"
        ? err.response.data.detail
        : "Erro ao iniciar o processamento.";
    showToast("Erro ao processar", { issues: [String(detail)], duration: 5000 });
  }

  /* ── Iniciar processamento real (novo upload) ───────────────── */
  async function startRealProcess(file: File) {
    setRowStatus("processing");
    setProcessProgress(0);
    setMetrics(null);
    patchLocalProjectData(projectId, { processStatus: "processing" });
    try {
      await persistColumns();
      const res = await uploadReport(projectId, file);
      setReportId(res.report_id);
      setExecutionId(res.execution_id);
      patchLocalProjectData(projectId, {
        reportId: res.report_id,
        executionId: res.execution_id,
        processStatus: "processing",
      });
    } catch (err) {
      setRowStatus("idle");
      patchLocalProjectData(projectId, { processStatus: null });
      reportProcessError(err);
    }
  }

  /* ── Reprocessar (reaproveita o arquivo já salvo no backend) ── */
  async function startReprocess() {
    if (!reportId) return;
    setRowStatus("processing");
    setProcessProgress(0);
    setMetrics(null);
    patchLocalProjectData(projectId, { processStatus: "processing" });
    try {
      await persistColumns();
      const exec = await reprocessReport(reportId, projectId);
      setExecutionId(exec.id);
      patchLocalProjectData(projectId, {
        executionId: exec.id,
        processStatus: "processing",
      });
    } catch (err) {
      setRowStatus("done");
      patchLocalProjectData(projectId, { processStatus: null });
      reportProcessError(err);
    }
  }

  function handleProcessClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // O job roda no backend — não há "pausar" durante o processamento.
    if (rowStatus === "processing") return;

    const issues = getConfigIssues();
    if (issues.length > 0) {
      showToast("Projeto não configurado corretamente", {
        issues,
        duration: 3500,
      });
      return;
    }

    // Arquivo novo anexado nesta sessão → novo upload.
    const freshFile = uploadedRawRef.current;
    if (freshFile) {
      startRealProcess(freshFile);
      return;
    }
    // Já existe um relatório no backend → reprocessa (sem reenviar bytes).
    if (reportId) {
      startReprocess();
      return;
    }
    // Sem bytes e sem relatório (ex: após reload) → pede reenvio.
    showToast("Reenvie o arquivo para processar", {
      issues: [
        "Os dados do arquivo não ficam salvos após recarregar a página. Reenvie o CSV/XLSX para processar.",
      ],
      duration: 5000,
    });
  }

  /* ── Download do resultado (via proxy de streaming) ──────────
   * Streama pelo backend (que lê o S3 internamente) em vez de
   * mandar o browser direto na presigned URL — o endpoint S3 não
   * é resolvível fora do Docker. */
  async function handleDownload() {
    if (!reportId || !executionId) return;
    let objectUrl: string | null = null;
    try {
      const blob = await getDownloadBlob(reportId, executionId, projectId);
      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = resultFileName(uploadedFile?.name);
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      showToast("Não foi possível baixar o resultado.", { duration: 3500 });
    } finally {
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 1000);
    }
  }

  /* ── Save handler ───────────────────────────────────────────── */
  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await update({
        name: title.trim(),
        description: description.trim(),
        ai_context: aiContext.trim(),
      });
      patchLocalProjectData(projectId, {
        uploadedFile: uploadedFile ?? null,
        normalizedFile: normalizedFile ?? null,
        columnsToNormalize: columnsWithNormalizations(columnConfigs),
        columnsToClassify: columnsWithClassification(columnConfigs),
        normalizationTypes: [],
        columnConfigs,
      });
      // Persiste a config de colunas no backend — não bloqueia o save do projeto.
      try {
        await persistColumns();
      } catch {
        // será reenviada no processamento
      }
      setSavedSnapshot({
        title: title.trim(),
        description: description.trim(),
        aiContext: aiContext.trim(),
        uploadedFileId: uploadedFile?.id ?? null,
      });
      showToast("Alterações salvas");
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data?.detail ?? "Erro ao salvar projeto.")
        : "Erro ao salvar projeto.";
      setSaveError(detail);
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete handler ─────────────────────────────────────────── */
  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await remove();
      setDeleteConfirmOpen(false);
      router.push("/projects");
    } catch (err) {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      const detail = axios.isAxiosError(err)
        ? (err.response?.data?.detail ?? "Erro ao deletar projeto.")
        : "Erro ao deletar projeto.";
      setSaveError(detail);
    }
  }

  /* ── Process button appearance ──────────────────────────────── */
  const btnClass =
    rowStatus === "processing"
      ? "process-btn process-btn--running"
      : rowStatus === "paused"
        ? "process-btn process-btn--paused"
        : rowStatus === "done" &&
            (iconPhase === "check" || iconPhase === "check-exit")
          ? "process-btn process-btn--running"
          : rowStatus === "done"
            ? "process-btn process-btn--done"
            : "process-btn";

  const btnIcon =
    rowStatus === "processing" ? (
      <span key="processing" className="process-btn-icon">
        <Loader2
          size={16}
          strokeWidth={2}
          style={{ animation: "spin 1s linear infinite" }}
        />
      </span>
    ) : iconPhase === "check" ? (
      <span key="check" className="process-btn-icon--check">
        <Check size={16} strokeWidth={2.5} />
      </span>
    ) : iconPhase === "check-exit" ? (
      <span key="check-exit" className="process-btn-icon--leaving">
        <Check size={16} strokeWidth={2.5} />
      </span>
    ) : (
      <span
        key={rowStatus === "done" ? "done-play" : rowStatus}
        className={`process-btn-icon${rowStatus === "paused" ? " process-btn-icon--paused" : ""}`}
      >
        <Play size={16} strokeWidth={2.2} />
      </span>
    );

  const btnLabel =
    rowStatus === "processing"
      ? "Processando…"
      : rowStatus === "done"
        ? "Reprocessar"
        : "Iniciar processamento";

  /* Mensagem de progresso — usa o step real do backend quando disponível.
   * A IA roda em background; o progresso pode não ser granular. */
  const processingMessage = execData?.current_step
    ? execData.current_step
    : execData?.status === "QUEUED"
      ? "Na fila para processamento…"
      : "Processando — normalização + classificação por IA. Pode levar alguns minutos.";

  /* ── Derived state for StatusDot ────────────────────────────── */
  const dotStatus: "active" | "pending" | "error" | "empty" = project?.hasError
    ? "error"
    : rowStatus === "done"
      ? "active"
      : rowStatus === "processing" || rowStatus === "paused"
        ? "pending"
        : "empty";

  /* ── Metrics (dynamic mock + backend TODOs) ─────────────────── */
  const projectActivities = activities.filter((a) => a.project_id === projectId);

  const totalSize = (uploadedFile?.size ?? 0) + (normalizedFile?.size ?? 0);
  /* Total de valores classificados pela IA (soma de classified_ok por coluna). */
  const totalClassified = Object.values(metrics?.columns ?? {}).reduce(
    (sum, c) => sum + c.classified_ok,
    0,
  );
  const firstClassifyCol = metrics
    ? Object.keys(metrics.columns)[0]
    : columnsWithClassification(columnConfigs)[0];
  const resumeItems = [
    {
      label: "Normalizações",
      value: project?.normalizations.toLocaleString("pt-BR") ?? "—",
    },
    {
      label: "Última Alteração",
      /* TODO (backend): use actual last status change timestamp */
      value: project?.lastRun
        ? formatRelativeDate(project.lastRun)
        : project?.createdAt
          ? formatRelativeDate(project.createdAt)
          : "—",
    },
    {
      label: "Linhas Processadas",
      value: normalizedFile?.rows
        ? formatRows(normalizedFile.rows)
        : uploadedFile?.rows
          ? formatRows(uploadedFile.rows)
          : "—",
    },
    {
      label: "Tamanho Total",
      value: totalSize > 0 ? formatSize(totalSize) : "—",
    },
    {
      label: "Tokens Gastos",
      /* TODO (backend): GET /api/projects/{id}/metrics — field: tokens_used */
      value: "—",
    },
  ];

  /* ── Render ─────────────────────────────────────────────────── */
  if (loading) return <ProjectLoadingSkeleton />;
  if (error && !(axios.isAxiosError(error) && error.response?.status === 404))
    return <ProjectErrorPage error={error} />;
  if (!project) return <ProjectNotFound />;

  /* Active file for drawer */
  const activeFile =
    activeView === "normalized" && normalizedFile
      ? normalizedFile
      : uploadedFile;
  const activeIsNormalized = activeView === "normalized" && !!normalizedFile;

  /* Dirty — any unsaved change to key fields */
  const isDirty =
    savedSnapshot !== null &&
    (title !== savedSnapshot.title ||
      description !== savedSnapshot.description ||
      aiContext !== savedSnapshot.aiContext ||
      (uploadedFile?.id ?? null) !== savedSnapshot.uploadedFileId);

  return (
    <>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 0.8fr",
          gridTemplateRows: "1fr",
          minHeight: 0,
        }}
      >
        {/* ══════════════════════════════════════════════════════════
          COLUMN 1 — Identidade + Arquivos
      ══════════════════════════════════════════════════════════ */}
        <div
          style={{
            borderRight: "1px solid rgba(0, 107, 90, 0.18)",
            background: "rgba(0, 107, 90, 0.025)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            className="scroll-styled"
            style={{
              padding: "40px 32px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb">
              <ol
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                <li style={{ display: "flex", alignItems: "center" }}>
                  <StatusDot status={dotStatus} justCompleted={justCompleted} />
                </li>
                <li>
                  <Link
                    href="/projects"
                    style={{
                      fontSize: "13px",
                      color: "var(--text-muted)",
                      textDecoration: "none",
                    }}
                  >
                    Projetos
                  </Link>
                </li>
                <li
                  aria-hidden="true"
                  style={{
                    color: "var(--primary-700)",
                    fontSize: "13px",
                    opacity: 0.6,
                  }}
                >
                  ·
                </li>
                <li
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  {title || project.title}
                </li>
              </ol>
            </nav>

            {/* Title */}
            <h1
              ref={titleRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setTitle(e.currentTarget.textContent ?? "")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLElement).blur();
                }
              }}
              className="new-project-title"
              style={{
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "var(--text-default)",
                outline: "none",
                cursor: "text",
                margin: 0,
                fontFamily: "var(--font-space-grotesk)",
                minHeight: "1.4em",
              }}
              role="heading"
              aria-level={1}
            />

            {/* Description */}
            <ProjectField
              label="Descrição"
              hint=""
              value={description}
              onChange={setDescription}
              minRows={3}
            />

            {/* AI Context */}
            <ProjectField
              label="Contexto para IA"
              hint="Instruções aplicadas a todas as execuções..."
              value={aiContext}
              onChange={setAiContext}
              minRows={4}
              icon={
                <Sparkles size={11} style={{ color: "var(--primary-700)" }} />
              }
            />

            {/* Arquivo Original */}
            <div>
              <FieldLabel>Arquivo Original</FieldLabel>
              <UploadSlot
                file={uploadedFile}
                onUpload={(f, raw) => {
                  uploadedRawRef.current = raw;
                  setUploadedFile(f);
                  setNormalizedFile(null);
                  setMetrics(null);
                  setReportId(null);
                  setExecutionId(null);
                  setRowStatus("idle");
                  setActiveView("upload");
                  patchLocalProjectData(projectId, {
                    uploadedFile: f,
                    normalizedFile: null,
                    reportId: null,
                    executionId: null,
                    classificationMetrics: null,
                    processStatus: null,
                  });
                }}
                onRemove={() => {
                  uploadedRawRef.current = null;
                  setUploadedFile(null);
                  setNormalizedFile(null);
                  setMetrics(null);
                  setReportId(null);
                  setExecutionId(null);
                  setRowStatus("idle");
                  patchLocalProjectData(projectId, {
                    uploadedFile: null,
                    normalizedFile: null,
                    reportId: null,
                    executionId: null,
                    classificationMetrics: null,
                    processStatus: null,
                  });
                }}
                onOpenDrawer={() => {
                  setActiveView("upload");
                  setDrawerOpen(true);
                }}
              />
            </div>

            {/* Arquivo Processado */}
            <div>
              <FieldLabel>Arquivo Processado</FieldLabel>
              {rowStatus === "processing" ? (
                <div
                  style={{
                    padding: "28px 20px",
                    border: "1px solid var(--border-default)",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    justifyContent: "center",
                  }}
                >
                  <Loader2
                    size={14}
                    strokeWidth={2}
                    style={{
                      color: "var(--primary-700)",
                      animation: "spin 1s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: "13px", color: "var(--primary-700)" }}
                  >
                    {processProgress > 0
                      ? `Processando… ${processProgress}%`
                      : "Processando…"}
                  </span>
                </div>
              ) : normalizedFile ? (
                <div
                  className="upload-slot-card-inner"
                  onClick={openNormalizedDrawer}
                  style={{ borderRadius: "10px", cursor: "pointer" }}
                >
                  <div
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      className="upload-slot-icon-bg"
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Sparkles
                        size={20}
                        strokeWidth={1.4}
                        style={{ color: "var(--text-accent)" }}
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
                        {normalizedFile.name}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                          marginTop: "3px",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatRows(normalizedFile.rows)} linhas ·{" "}
                        {formatSize(normalizedFile.size)} ·{" "}
                        {formatRelativeDate(normalizedFile.generatedAt)}
                      </div>
                    </div>
                  </div>
                  <div
                    className="upload-slot-footer"
                    style={{ padding: "8px 20px" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload();
                      }}
                      style={{
                        fontSize: "12px",
                        color: "var(--text-accent)",
                        fontWeight: 500,
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      Baixar resultado
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: "1.5px dashed var(--border-default)",
                    borderRadius: "10px",
                    padding: "28px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--text-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    O arquivo processado aparecerá aqui
                    <br />
                    após a execução.
                  </span>
                  <button
                    className={btnClass}
                    onClick={handleProcessClick}
                    aria-label={btnLabel}
                    title={btnLabel}
                  >
                    {btnIcon}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Col 1 bottom: save (left) + destructive (right) ──── */}
          <div
            style={{
              borderTop: "1px solid rgba(0, 107, 90, 0.12)",
              padding: "16px 32px 24px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* Save — left */}
            {saveError && (
              <span style={{ fontSize: "12px", color: "#ef4444" }}>
                {saveError}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className={isDirty ? "save-btn-dirty" : ""}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "17px",
                fontWeight: 500,
                color: isDirty ? "var(--text-accent)" : "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                padding: "4px 0",
                transition: "color 150ms ease",
                opacity: saving ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isDirty)
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-accent)";
              }}
              onMouseLeave={(e) => {
                if (!isDirty)
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)";
              }}
            >
              <Save size={19} strokeWidth={1.8} />
              {saving ? "Salvando…" : "Salvar"}
            </button>

            {/* Arquivar + Deletar — right */}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: "28px",
              }}
            >
              <button
                onClick={() => setArchiveConfirmOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "17px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  transition: "color 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#ca8a04";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)";
                }}
              >
                <Archive size={19} strokeWidth={1.8} />
                Arquivar
              </button>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "17px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  transition: "color 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#ef4444";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)";
                }}
              >
                <Trash2 size={19} strokeWidth={1.8} />
                Deletar
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
          COLUMN 2 — Métricas + Ações
      ══════════════════════════════════════════════════════════ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            className="scroll-styled"
            style={{ flex: 1, overflowY: "auto", padding: "40px 28px 28px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-default)",
                  fontFamily: "var(--font-space-grotesk)",
                }}
              >
                Métricas
              </h2>
              <button
                onClick={() => setConfigOpen(true)}
                aria-label="Configurações do projeto"
                title="Configurações"
                className={
                  markedColumns.some((column) => {
                    const config = columnConfigs[column];
                    return !config || (!config.classify && config.normalizationTypes.length === 0);
                  })
                    ? "config-btn-needs-setup"
                    : undefined
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-secondary, oklch(45% 0.02 165))",
                  cursor: "pointer",
                  transition: "background 120ms ease, color 120ms ease",
                  marginTop: "-16px",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-tinted)";
                  e.currentTarget.style.color = "var(--text-default)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary, oklch(45% 0.02 165))";
                }}
              >
                <SlidersHorizontal size={16} strokeWidth={1.8} />
              </button>
            </div>

            {/* ── Resumo ────────────────────────────────────────── */}
            <SubLabel>Resumo</SubLabel>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "28px",
              }}
            >
              {resumeItems.map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{ fontSize: "13px", color: "var(--text-secondary)" }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-default)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border-default)",
                marginBottom: "24px",
              }}
            />

            {/* ── Histórico ─────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <SubLabel>Histórico</SubLabel>
              <Clock
                size={13}
                strokeWidth={1.8}
                style={{ color: "var(--text-muted)", marginTop: "-12px" }}
              />
            </div>
            {projectActivities.length === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  margin: "0 0 28px",
                }}
              >
                Nenhuma atividade registrada.
              </p>
            ) : (
              <div
                className="scroll-styled"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "126px",
                  overflowY: "auto",
                  paddingRight: "4px",
                  marginBottom: "28px",
                }}
              >
                {projectActivities.map(({ id, type, created_at }, i) => {
                  const cfg = ACTIVITY_CONFIG[type];
                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        minHeight: "30px",
                      }}
                    >
                      <div
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: cfg.color,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          color: i === 0 ? "var(--text-default)" : "var(--text-secondary)",
                          fontWeight: i === 0 ? 500 : 400,
                          flex: 1,
                        }}
                      >
                        {formatRelativeDate(created_at)}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: cfg.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div
              style={{
                borderTop: "1px solid var(--border-default)",
                marginBottom: "24px",
              }}
            />

            {/* ── Insights da Execução ──────────────────────────── */}
            {/* TODO (backend): replace with GET /api/projects/{id}/insights
              Expected: { consolidations: number; categories_count: number; nulls_treated: number; column_name: string }
          */}
            <SubLabel>Insights da Execução</SubLabel>
            {rowStatus === "done" || project.normalizedFile ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      letterSpacing: "-0.025em",
                      color: "var(--text-default)",
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "var(--font-archivo)",
                    }}
                  >
                    {project.normalizations > 0
                      ? `${project.normalizations.toLocaleString("pt-BR")} → ${Math.round(project.normalizations * 0.013).toLocaleString("pt-BR")}`
                      : "—"}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      marginTop: "3px",
                    }}
                  >
                    valores únicos após normalização
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      letterSpacing: "-0.025em",
                      color: "var(--text-default)",
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "var(--font-archivo)",
                    }}
                  >
                    {totalClassified > 0
                      ? totalClassified.toLocaleString("pt-BR")
                      : "—"}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      marginTop: "3px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    classificações aplicadas
                    {firstClassifyCol && (
                      <code
                        style={{
                          fontSize: "11px",
                          background: "var(--bg-subtle)",
                          borderRadius: "4px",
                          padding: "1px 5px",
                          fontFamily: "monospace",
                        }}
                      >
                        {firstClassifyCol}
                      </code>
                    )}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      letterSpacing: "-0.025em",
                      color: "var(--text-default)",
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "var(--font-archivo)",
                    }}
                  >
                    {/* TODO (backend): field nulls_treated from /insights */}—
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      marginTop: "3px",
                    }}
                  >
                    nulos disfarçados tratados
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "16px 0",
                }}
              >
                <Zap
                  size={15}
                  strokeWidth={1.6}
                  style={{ color: "var(--text-muted)" }}
                />
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Disponível após a primeira execução.
                </span>
              </div>
            )}

            {/* ── Classificação por IA (métricas reais da execução) ── */}
            {metrics && Object.keys(metrics.columns).length > 0 && (
              <>
                <div
                  style={{
                    borderTop: "1px solid var(--border-default)",
                    margin: "24px 0",
                  }}
                />
                <ClassificationMetricsPanel metrics={metrics} />
              </>
            )}
          </div>

          {/* ── Col 2 bottom: process button + progress ──────────── */}
          <div
            style={{
              padding: "20px 28px 28px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* Progress bar + message — visible while active */}
            {(rowStatus === "processing" || rowStatus === "paused") && (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    fontSize: "11.5px",
                    color:
                      rowStatus === "paused"
                        ? "var(--text-muted)"
                        : "var(--text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "color 300ms ease",
                  }}
                >
                  {processingMessage}
                </span>
                {processProgress > 0 ? (
                  <div
                    style={{
                      height: "3px",
                      borderRadius: "2px",
                      background: "var(--bg-subtle)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${processProgress}%`,
                        borderRadius: "2px",
                        background: "var(--primary-700, oklch(38% 0.12 165))",
                        transition: "width 400ms ease",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="progress-bar-indeterminate"
                    style={{
                      height: "3px",
                      borderRadius: "2px",
                      background: "var(--bg-subtle)",
                    }}
                  />
                )}
              </div>
            )}

            {/* Spacer when idle/done so button stays right */}
            {rowStatus !== "processing" && rowStatus !== "paused" && (
              <div style={{ flex: 1 }} />
            )}

            {/* Larger process button */}
            <button
              className={btnClass}
              onClick={handleProcessClick}
              aria-label={btnLabel}
              title={btnLabel}
              style={{ width: "66px", height: "66px", flexShrink: 0 }}
            >
              {rowStatus === "processing" ? (
                <Loader2
                  size={40}
                  strokeWidth={1.8}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : iconPhase === "check" ? (
                <Check size={40} strokeWidth={2.2} />
              ) : iconPhase === "check-exit" ? (
                <Check size={40} strokeWidth={2.2} />
              ) : (
                <Play size={40} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Delete confirmation ──────────────────────────────────── */}
      {deleteConfirmOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              onClick={() => setDeleteConfirmOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 12, 9, 0.4)",
              }}
            />
            <div
              style={{
                position: "relative",
                background: "var(--bg-surface)",
                borderRadius: "12px",
                padding: "28px 32px",
                width: "400px",
                maxWidth: "90vw",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Trash2
                    size={15}
                    strokeWidth={1.8}
                    style={{ color: "#ef4444" }}
                  />
                </div>
                <h2
                  id="delete-modal-title"
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--text-default)",
                    margin: 0,
                  }}
                >
                  Excluir projeto
                </h2>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  margin: "0 0 24px",
                  lineHeight: 1.55,
                }}
              >
                Tem certeza que deseja excluir{" "}
                <strong style={{ color: "var(--text-default)" }}>
                  {title}
                </strong>
                ? Esta ação não pode ser desfeita.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleting}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-default)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    cursor: deleting ? "not-allowed" : "pointer",
                    opacity: deleting ? 0.7 : 1,
                  }}
                >
                  {deleting ? "Excluindo…" : "Excluir"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Archive confirmation ─────────────────────────────────── */}
      {archiveConfirmOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              onClick={() => setArchiveConfirmOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 12, 9, 0.4)",
              }}
            />
            <div
              style={{
                position: "relative",
                background: "var(--bg-surface)",
                borderRadius: "12px",
                padding: "28px 32px",
                width: "400px",
                maxWidth: "90vw",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(234, 179, 8, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Archive
                    size={15}
                    strokeWidth={1.8}
                    style={{ color: "#eab308" }}
                  />
                </div>
                <h2
                  id="archive-modal-title"
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--text-default)",
                    margin: 0,
                  }}
                >
                  Arquivar projeto
                </h2>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  margin: "0 0 24px",
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: "var(--text-default)" }}>
                  {title}
                </strong>{" "}
                será movido para o arquivo e não aparecerá na lista principal.
                Você pode restaurá-lo a qualquer momento.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setArchiveConfirmOpen(false)}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-default)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setArchiveConfirmOpen(false)}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#eab308",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Arquivar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Database Drawer ─────────────────────────────────────── */}
      {drawerOpen && activeFile && (
        <DatabaseDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          file={activeFile}
          isNormalized={activeIsNormalized}
          normalizedPreviewLoading={normalizedPreviewLoading}
          markedColumns={markedColumns}
          onColumnsChange={(cols) => {
            setMarkedColumns(cols);
            const nextConfigs = syncColumnConfigKeys(cols, columnConfigs);
            setColumnConfigs(nextConfigs);
            patchLocalProjectData(projectId, {
              columnsToNormalize: columnsWithNormalizations(nextConfigs),
              columnsToClassify: columnsWithClassification(nextConfigs),
              normalizationTypes: [],
              columnConfigs: nextConfigs,
            });
          }}
        />
      )}

      {/* ── Config Drawer ───────────────────────────────────────── */}
      <ConfigDrawer
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        columns={markedColumns}
        columnConfigs={columnConfigs}
        normalizedFile={normalizedFile}
        hasProcessed={rowStatus === "done" || !!normalizedFile}
        onEditNormalization={() => {
          if (uploadedFile) {
            setActiveView("upload");
            setDrawerOpen(true);
          }
        }}
        onOpenNormalized={() => {
          openNormalizedDrawer();
        }}
        onColumnConfigsChange={(configs) => {
          setColumnConfigs(configs);
          patchLocalProjectData(projectId, {
            columnsToNormalize: columnsWithNormalizations(configs),
            columnsToClassify: columnsWithClassification(configs),
            normalizationTypes: [],
            columnConfigs: configs,
          });
        }}
      />
    </>
  );
}
