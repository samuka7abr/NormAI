"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "seen-projects";

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function useSeenProjects() {
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  const isNew = useCallback(
    (id: string) => !seen.has(id),
    [seen]
  );

  return { isNew, markSeen };
}
