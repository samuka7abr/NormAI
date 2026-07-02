export type ActivityType = "upload" | "processing_done" | "project_created" | "needs_action" | "processing_start";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  project_name: string;
  project_id: string;
  created_at: string;
}
