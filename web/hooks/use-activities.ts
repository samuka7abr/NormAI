"use client";

import { useState, useEffect, useCallback } from "react";
import { listActivities, type ActivitiesPage } from "@/lib/activities";
import type { ActivityEvent } from "@/types/activity";

interface UseActivitiesReturn {
  activities: ActivityEvent[];
  total: number;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useActivities(
  limit = 20,
  offset = 0,
  pollInterval?: number,
): UseActivitiesReturn {
  const [data, setData] = useState<ActivitiesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listActivities(limit, offset)
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
  }, [limit, offset, tick]);

  /* Polling — optional interval that triggers a silent refetch */
  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(() => setTick((t) => t + 1), pollInterval);
    return () => clearInterval(id);
  }, [pollInterval]);

  return {
    activities: data?.items ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}
