"use client";

import { useState, useCallback, useEffect } from "react";
import type { ActivityEvent } from "@/types/activity";

const SEEN_KEY    = "sb-notif-seen-at";
const CLEARED_KEY = "sb-notif-cleared-at";

export function useSeenNotifications() {
  const [lastSeenAt,    setLastSeenAt]    = useState<string | null>(null);
  const [lastClearedAt, setLastClearedAt] = useState<string | null>(null);

  useEffect(() => {
    setLastSeenAt(localStorage.getItem(SEEN_KEY));
    setLastClearedAt(localStorage.getItem(CLEARED_KEY));
  }, []);

  /** Called when the panel opens — marks all current notifications as seen. */
  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(SEEN_KEY, now);
    setLastSeenAt(now);
  }, []);

  /** Called when "Limpar" is clicked — hides all current notifications. */
  const clearAll = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(CLEARED_KEY, now);
    localStorage.setItem(SEEN_KEY, now);
    setLastClearedAt(now);
    setLastSeenAt(now);
  }, []);

  /** True when any activity arrived after the last panel-open. */
  const hasNew = useCallback(
    (activities: ActivityEvent[]) => {
      if (!lastSeenAt) return activities.length > 0;
      return activities.some((a) => a.created_at > lastSeenAt);
    },
    [lastSeenAt],
  );

  /** Filters out activities cleared by the user. */
  const visibleActivities = useCallback(
    (activities: ActivityEvent[]) => {
      if (!lastClearedAt) return activities;
      return activities.filter((a) => a.created_at > lastClearedAt);
    },
    [lastClearedAt],
  );

  return { markSeen, clearAll, hasNew, visibleActivities };
}
