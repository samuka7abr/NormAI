"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Play } from "lucide-react";
import type { Project } from "@/types/project";
import { formatRelativeDate } from "@/lib/format-date";
import { patchLocalProjectData, getLocalProjectData } from "@/lib/projects";
import { reprocessReport } from "@/lib/reports";
import { useToast } from "@/components/ui/toast";
import { StatusDot } from "./_shared/status-dot";

/* ── Row component ───────────────────────────────────────────── */
type RowProcessStatus = "idle" | "processing" | "done" | "error";

interface ProjectRowProps {
  project: Project;
  isNew?: boolean;
  onSeen?: () => void;
}

export function ProjectRow({
  project,
  isNew = false,
  onSeen,
}: ProjectRowProps) {
  const router = useRouter();
  const { show: showToast } = useToast();

  /* Estado derivado do projeto (localStorage via toProject). */
  const [rowStatus, setRowStatus] = useState<RowProcessStatus>(
    project.normalizedFile
      ? "done"
      : project.processStatus === "processing"
        ? "processing"
        : "idle",
  );

  /* True after a run completes — cleared when the user opens the project. */
  const [justCompleted, setJustCompleted] = useState(false);

  /* Sync if project data changes externally (e.g. list refresh). */
  useEffect(() => {
    if (project.normalizedFile) setRowStatus("done");
    else if (project.processStatus === "processing") setRowStatus("processing");
  }, [project]);

  /* Status dot — driven by rowStatus. */
  const dotStatus: "active" | "pending" | "error" | "empty" =
    project.hasError ? "error"
    : rowStatus === "done" ? "active"
    : rowStatus === "processing" ? "pending"
    : "empty";

  /* ── Process action ─────────────────────────────────────────── */
  /* O processamento real (upload + polling + métricas) acontece na tela
   * do projeto. Aqui: se já existe um relatório no backend, dispara um
   * reprocessamento real; caso contrário, leva o usuário ao projeto para
   * subir o arquivo. */
  function handleProcessClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (rowStatus === "processing") {
      router.push(`/projects/${project.id}`);
      return;
    }

    const local = getLocalProjectData(project.id);
    if (!local.reportId) {
      // Sem relatório no backend → precisa subir o arquivo na tela do projeto.
      router.push(`/projects/${project.id}`);
      return;
    }

    setRowStatus("processing");
    patchLocalProjectData(project.id, { processStatus: "processing" });
    reprocessReport(local.reportId, project.id)
      .then((exec) => {
        patchLocalProjectData(project.id, {
          executionId: exec.id,
          processStatus: "processing",
        });
        showToast("Reprocessamento iniciado", { duration: 2500 });
      })
      .catch(() => {
        setRowStatus(project.normalizedFile ? "done" : "idle");
        patchLocalProjectData(project.id, { processStatus: null });
        showToast("Não foi possível reprocessar", { duration: 3500 });
      });
  }

  /* ── Button appearance ──────────────────────────────────────── */
  const btnClass =
    rowStatus === "processing"
      ? "process-btn process-btn--running"
      : rowStatus === "done"
        ? "process-btn process-btn--done"
        : "process-btn";

  const btnIcon =
    rowStatus === "processing" ? (
      <span key="processing" className="process-btn-icon">
        <Loader2
          size={16}
          strokeWidth={2}
          style={{ animation: "spin 1s linear infinite" }}
        />
      </span>
    ) : (
      <span key={rowStatus} className="process-btn-icon">
        <Play size={16} strokeWidth={2.2} />
      </span>
    );

  const btnLabel =
    rowStatus === "processing"
      ? "Ver processamento"
      : rowStatus === "done"
        ? "Reprocessar"
        : "Iniciar processamento";

  return (
    <li>
      <div className="project-row-item">
        {/* ── Process button — icon only, sharp corners ────────── */}
        <button
          className={btnClass}
          onClick={handleProcessClick}
          aria-label={`${btnLabel}: ${project.title}`}
          title={btnLabel}
        >
          {btnIcon}
        </button>

        {/* ── Row link ─────────────────────────────────────────── */}
        <Link
          href={`/projects/${project.id}`}
          className="project-row"
          onClick={() => {
            if (isNew && onSeen) onSeen();
            if (justCompleted) setJustCompleted(false);
          }}
        >
          {/* Title + description */}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "17px",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--text-default)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {project.title}
            </div>
            {project.description && (
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 400,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: "2px",
                }}
              >
                {project.description}
              </div>
            )}
          </div>

          {/* Status dot */}
          <StatusDot
            status={dotStatus}
            isNew={isNew}
            justCompleted={justCompleted}
          />

          {/* Normalizations */}
          <div
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              textAlign: "right",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {project.normalizations > 0
              ? `${project.normalizations.toLocaleString("pt-BR")} norm.`
              : "—"}
          </div>

          {/* Date */}
          <div
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "var(--text-secondary)",
              textAlign: "right",
            }}
          >
            {project.lastRun
              ? formatRelativeDate(project.lastRun)
              : formatRelativeDate(project.createdAt)}
          </div>

          {/* Chevron */}
          <div
            className="project-row-chevron"
            style={{
              display: "flex",
              justifyContent: "center",
              paddingLeft: "8px",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronRight size={24} strokeWidth={2.2} />
          </div>
        </Link>
      </div>
    </li>
  );
}
