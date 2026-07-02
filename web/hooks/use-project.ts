"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getProject,
  updateProject,
  deleteProject,
  type UpdateProjectDto,
} from "@/lib/projects";
import type { Project } from "@/types/project";

interface UseProjectReturn {
  project: Project | null;
  loading: boolean;
  error: Error | null;
  update: (dto: UpdateProjectDto) => Promise<Project>;
  remove: () => Promise<void>;
  refresh: () => void;
}

export function useProject(id: string): UseProjectReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProject(id)
      .then((result) => {
        if (!cancelled) setProject(result);
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
  }, [id, tick]);

  const update = useCallback(
    async (dto: UpdateProjectDto) => {
      const updated = await updateProject(id, dto);
      setProject(updated);
      return updated;
    },
    [id]
  );

  const remove = useCallback(async () => {
    await deleteProject(id);
  }, [id]);

  return {
    project,
    loading,
    error,
    update,
    remove,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}
