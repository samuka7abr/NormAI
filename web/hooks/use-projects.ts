"use client";

import { useState, useEffect, useCallback } from "react";
import { listProjects, type ProjectsPage } from "@/lib/projects";
import type { Project } from "@/types/project";

interface UseProjectsReturn {
  projects: Project[];
  total: number;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useProjects(page = 1, pageSize = 50): UseProjectsReturn {
  const [data, setData] = useState<ProjectsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listProjects(page, pageSize)
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
  }, [page, pageSize, tick]);

  return {
    projects: data?.items ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}
