"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listGlobalEntries,
  listProjectEntries,
  createGlobalEntry,
  createProjectEntry,
  updateGlobalEntry,
  updateProjectEntry,
  deleteGlobalEntry,
  deleteProjectEntry,
  type ListParams,
} from "@/lib/dictionary";
import type {
  DictionaryEntry,
  DictionaryPage,
  CreateEntryInput,
  UpdateEntryInput,
  EntryKind,
} from "@/types/dictionary";

export type DictionaryScope =
  | { kind: "global" }
  | { kind: "project"; projectId: string };

export interface UseEntriesOptions {
  kindFilter?: EntryKind;
  page?: number;
  pageSize?: number;
}

interface UseEntriesReturn {
  entries: DictionaryEntry[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useEntries(
  scope: DictionaryScope,
  opts: UseEntriesOptions = {},
): UseEntriesReturn {
  const { kindFilter, page = 1, pageSize = 20 } = opts;
  const projectId = scope.kind === "project" ? scope.projectId : null;

  const [data, setData] = useState<DictionaryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: ListParams = {
      page,
      pageSize,
      ...(kindFilter !== undefined && { kind: kindFilter }),
    };

    const request =
      projectId === null
        ? listGlobalEntries(params)
        : listProjectEntries(projectId, params);

    request
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, kindFilter, page, pageSize, tick]);

  return {
    entries: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    loading,
    error,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}

interface UseMutationsReturn {
  create: (input: CreateEntryInput) => Promise<DictionaryEntry>;
  update: (id: string, input: UpdateEntryInput) => Promise<DictionaryEntry>;
  remove: (id: string) => Promise<void>;
}

export function useDictionaryMutations(
  scope: DictionaryScope,
): UseMutationsReturn {
  const projectId = scope.kind === "project" ? scope.projectId : null;

  const create = useCallback(
    (input: CreateEntryInput) =>
      projectId === null
        ? createGlobalEntry(input)
        : createProjectEntry(projectId, input),
    [projectId],
  );

  const update = useCallback(
    (id: string, input: UpdateEntryInput) =>
      projectId === null
        ? updateGlobalEntry(id, input)
        : updateProjectEntry(projectId, id, input),
    [projectId],
  );

  const remove = useCallback(
    (id: string) =>
      projectId === null
        ? deleteGlobalEntry(id)
        : deleteProjectEntry(projectId, id),
    [projectId],
  );

  return { create, update, remove };
}

export function useDictionary(
  scope: DictionaryScope,
  opts: UseEntriesOptions = {},
) {
  const listState = useEntries(scope, opts);
  const { create: mutateCreate, update: mutateUpdate, remove: mutateRemove } =
    useDictionaryMutations(scope);
  const { refresh } = listState;

  const create = useCallback(
    async (input: CreateEntryInput) => {
      const entry = await mutateCreate(input);
      refresh();
      return entry;
    },
    [mutateCreate, refresh],
  );

  const update = useCallback(
    async (id: string, input: UpdateEntryInput) => {
      const entry = await mutateUpdate(id, input);
      refresh();
      return entry;
    },
    [mutateUpdate, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await mutateRemove(id);
      refresh();
    },
    [mutateRemove, refresh],
  );

  return { ...listState, create, update, remove };
}
