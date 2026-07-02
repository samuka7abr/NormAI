import type { Project } from "@/types/project";

export type FilterValue = "all" | "active" | "pending" | "error";

export const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",     label: "Todos" },
  { value: "active",  label: "Concluído" },
  { value: "pending", label: "Processando" },
  { value: "error",   label: "Requer Ação" },
];

export const STATUS_COLOR: Record<string, string> = {
  active:  "#22c55e",
  pending: "#f59e0b",
  error:   "#ef4444",
  empty:   "#c4cbc8",
};

export const STATUS_LABEL: Record<string, string> = {
  active:  "Com relatório",
  pending: "Aguardando processamento",
  error:   "Requer ação",
  empty:   "Sem upload",
};

export function getStatus(p: Project): "active" | "pending" | "error" | "empty" {
  if (p.hasError)       return "error";
  if (p.normalizedFile) return "active";
  if (p.uploadedFile)   return "pending";
  return "empty";
}
