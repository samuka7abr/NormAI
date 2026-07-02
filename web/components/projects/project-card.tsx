import type { Project } from "@/types/project";

/* ── Status derivado do tipo atual ──────────────────────────── */
type StatusKey = "ativo" | "processando" | "aguardando" | "vazio";

function getStatus(p: Project): StatusKey {
  if (p.normalizedFile) return "ativo";
  if (p.uploadedFile) return "processando";
  if (p.tasks.normalize || p.tasks.classify) return "aguardando";
  return "vazio";
}

const STATUS_CONFIG: Record<StatusKey, { label: string; bg: string; color: string }> = {
  ativo: {
    label: "Ativo",
    bg: "rgba(0, 107, 90, 0.10)",
    color: "var(--primary-700)",
  },
  processando: {
    label: "Processando",
    bg: "rgba(217, 119, 6, 0.10)",
    color: "#92400e",
  },
  aguardando: {
    label: "Aguardando configuração",
    bg: "var(--gray-50)",
    color: "var(--gray-600)",
  },
  vazio: {
    label: "Sem upload",
    bg: "var(--gray-50)",
    color: "var(--gray-600)",
  },
};

/* ── Time helper ───────────────────────────────────────────── */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/* ── Component ─────────────────────────────────────────────── */
interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const status = getStatus(project);
  const { label, bg, color } = STATUS_CONFIG[status];
  const dateStr = project.lastRun ?? project.createdAt;

  return (
    <article className="project-card">

      {/* ── Status badge ──── */}
      <span
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: "5px",
          background: bg,
          color,
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          padding: "3px 9px",
          borderRadius: "999px",
        }}
      >
        {status === "processando" && (
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "#d97706",
              animation: "pulse 1.8s ease-in-out infinite",
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
        )}
        {label}
      </span>

      {/* ── Title ──────────────────────────────────────────── */}
      <h2
        style={{
          margin: 0,
          marginTop: "8px",
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 700,
          fontSize: "19px",
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
          color: "var(--text-default)",
        }}
      >
        {project.title}
      </h2>

      {/* ── Description ────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", marginTop: "10px" }}>
        <p
          className="card-description"
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          {project.description}
        </p>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        style={{
          marginTop: "20px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {formatRelativeTime(dateStr)}
        </span>
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-accent)" }}>
          {project.normalizations} {project.normalizations === 1 ? "Normalização" : "Normalizações"}
        </span>
      </div>
    </article>
  );
}
