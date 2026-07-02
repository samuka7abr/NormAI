import api from './api';
import type {
  Project,
  UploadedFile,
  NormalizedFile,
  NormalizationType,
  ColumnProcessingConfigMap,
} from '@/types/project';
import type { ClassificationMetrics } from '@/types/report';

/* ── Local project config (stored in localStorage, keyed by project id) ── */
export interface LocalProjectData {
  uploadedFile?: UploadedFile | null;
  normalizedFile?: NormalizedFile | null;
  tasks?: { normalize: boolean; classify: boolean };
  columnsToNormalize?: string[];
  normalizationTypes?: NormalizationType[];
  columnsToClassify?: string[];
  columnConfigs?: ColumnProcessingConfigMap;
  /**
   * Estado de processamento. Mantido em localStorage para restaurar a UI
   * após reload; a fonte de verdade do progresso é o polling da execução.
   */
  processStatus?: "processing" | "paused" | null;
  /** IDs da última execução real no backend (sobrevivem a reload p/ polling). */
  reportId?: string | null;
  executionId?: string | null;
  /** Métricas de classificação da última execução concluída. */
  classificationMetrics?: ClassificationMetrics | null;
}

const LOCAL_KEY = (id: string) => `project-local:${id}`;

export function saveLocalProjectData(id: string, data: LocalProjectData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY(id), JSON.stringify(data));
  } catch {}
}

/** Merge-patch: only updates the provided fields, preserves the rest. */
export function patchLocalProjectData(id: string, patch: Partial<LocalProjectData>): void {
  const existing = getLocalProjectData(id);
  saveLocalProjectData(id, { ...existing, ...patch });
}

export function getLocalProjectData(id: string): LocalProjectData {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY(id));
    return raw ? (JSON.parse(raw) as LocalProjectData) : {};
  } catch {
    return {};
  }
}

interface ApiProject {
  id: string;
  user_id: string;
  name: string;
  description: string;
  ai_context: string;
  created_at: string;
  updated_at: string;
}

interface ApiProjectsPage {
  items: ApiProject[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ProjectsPage {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  ai_context?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  ai_context?: string;
}

function toProject(p: ApiProject): Project {
  const local = getLocalProjectData(p.id);
  const columnConfigs = local.columnConfigs ?? buildLegacyColumnConfigs(
    local.columnsToNormalize ?? [],
    local.normalizationTypes ?? [],
    local.columnsToClassify ?? [],
  );
  // SIMULAÇÃO: expõe processStatus para que o ProjectRow restaure o estado correto.
  // Com backend real: remover e usar p.status diretamente.
  return {
    id: p.id,
    title: p.name,
    description: p.description,
    aiContext: p.ai_context,
    tasks: local.tasks ?? { normalize: false, classify: false },
    columnsToNormalize: local.columnsToNormalize ?? columnsWithNormalizations(columnConfigs),
    normalizationTypes: local.normalizationTypes ?? [],
    columnsToClassify: local.columnsToClassify ?? columnsWithClassification(columnConfigs),
    columnConfigs,
    normalizations: 0,
    classifications: 0,
    lastRun: null,
    createdAt: p.created_at,
    uploadedFile: local.uploadedFile ?? null,
    normalizedFile: local.normalizedFile ?? null,
    processStatus: local.processStatus ?? null,
  };
}

function buildLegacyColumnConfigs(
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

export async function listProjects(page = 1, pageSize = 50): Promise<ProjectsPage> {
  const { data } = await api.get<ApiProjectsPage>('/projects', {
    params: { page, page_size: pageSize },
  });
  return {
    items: data.items.map(toProject),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    totalPages: data.total_pages,
  };
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await api.get<ApiProject>(`/projects/${id}`);
  return toProject(data);
}

export async function createProject(dto: CreateProjectDto): Promise<Project> {
  const { data } = await api.post<ApiProject>('/projects', dto);
  return toProject(data);
}

export async function updateProject(id: string, dto: UpdateProjectDto): Promise<Project> {
  const { data } = await api.patch<ApiProject>(`/projects/${id}`, dto);
  return toProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}
