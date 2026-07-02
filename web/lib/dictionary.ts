import api from './api';
import type {
  DictionaryEntry,
  DictionaryPage,
  CreateEntryInput,
  UpdateEntryInput,
  EntryKind,
} from '@/types/dictionary';

interface ApiEntry {
  id: string;
  type: EntryKind;     // API serialises "kind" as "type"
  title: string;       // API serialises "name" as "title"
  description: string;
  used_in: string[];
  updated_at: string;
  items: string[] | null;
  content: string | null;
}

interface ApiDictionaryPage {
  items: ApiEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListParams {
  kind?: EntryKind;
  page?: number;
  pageSize?: number;
}

function toEntry(e: ApiEntry): DictionaryEntry {
  return {
    id: e.id,
    kind: e.type,
    name: e.title,
    description: e.description,
    usedIn: e.used_in,
    updatedAt: e.updated_at,
    items: e.items,
    content: e.content,
  };
}

function createService(baseUrl: string) {
  async function list(params: ListParams = {}): Promise<DictionaryPage> {
    const { data } = await api.get<ApiDictionaryPage>(baseUrl, {
      params: {
        ...(params.kind !== undefined && { kind: params.kind }),
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
      },
    });
    return {
      items: data.items.map(toEntry),
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
      totalPages: data.total_pages,
    };
  }

  async function get(id: string): Promise<DictionaryEntry> {
    const { data } = await api.get<ApiEntry>(`${baseUrl}/${id}`);
    return toEntry(data);
  }

  async function create(input: CreateEntryInput): Promise<DictionaryEntry> {
    const { data } = await api.post<ApiEntry>(baseUrl, {
      kind: input.kind,
      name: input.name,
      description: input.description ?? '',
      ...(input.items !== undefined && { items: input.items }),
      ...(input.content !== undefined && { content: input.content }),
    });
    return toEntry(data);
  }

  async function update(id: string, input: UpdateEntryInput): Promise<DictionaryEntry> {
    const { data } = await api.patch<ApiEntry>(`${baseUrl}/${id}`, input);
    return toEntry(data);
  }

  async function remove(id: string): Promise<void> {
    await api.delete(`${baseUrl}/${id}`);
  }

  return { list, get, create, update, remove };
}

// ── Global dictionary (/dictionary) ──────────────────────────────
const globalService = createService('/dictionary');

export function listGlobalEntries(params?: ListParams) {
  return globalService.list(params);
}
export function getGlobalEntry(id: string) {
  return globalService.get(id);
}
export function createGlobalEntry(input: CreateEntryInput) {
  return globalService.create(input);
}
export function updateGlobalEntry(id: string, input: UpdateEntryInput) {
  return globalService.update(id, input);
}
export function deleteGlobalEntry(id: string) {
  return globalService.remove(id);
}

// ── Project-scoped dictionary (/projects/{id}/dictionary) ─────────
export function listProjectEntries(projectId: string, params?: ListParams) {
  return createService(`/projects/${projectId}/dictionary`).list(params);
}
export function getProjectEntry(projectId: string, id: string) {
  return createService(`/projects/${projectId}/dictionary`).get(id);
}
export function createProjectEntry(projectId: string, input: CreateEntryInput) {
  return createService(`/projects/${projectId}/dictionary`).create(input);
}
export function updateProjectEntry(projectId: string, id: string, input: UpdateEntryInput) {
  return createService(`/projects/${projectId}/dictionary`).update(id, input);
}
export function deleteProjectEntry(projectId: string, id: string) {
  return createService(`/projects/${projectId}/dictionary`).remove(id);
}
