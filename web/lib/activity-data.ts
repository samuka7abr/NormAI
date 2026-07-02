import { FolderPlus, Sparkles, Upload, AlertCircle, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityType } from "@/types/activity";

export const ACTIVITY_CONFIG: Record<ActivityType, { label: string; Icon: LucideIcon; color: string }> = {
  upload:           { label: "Upload realizado",        Icon: Upload,       color: "#3b82f6" },
  processing_done:  { label: "Processamento concluído", Icon: Sparkles,     color: "var(--primary-700, oklch(38% 0.12 165))" },
  project_created:  { label: "Projeto criado",          Icon: FolderPlus,   color: "#8b5cf6" },
  needs_action:     { label: "Requer ação",             Icon: AlertCircle,  color: "#f59e0b" },
  processing_start: { label: "Iniciando processamento", Icon: Play,         color: "#06b6d4" },
};
