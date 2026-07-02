import api from "./api";
import type { ActivityEvent } from "@/types/activity";

export interface ActivitiesPage {
  items: ActivityEvent[];
  total: number;
}

export async function listActivities(limit = 20, offset = 0): Promise<ActivitiesPage> {
  const { data } = await api.get<ActivitiesPage>("/activities", {
    params: { limit, offset },
  });
  return data;
}
