"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/types/project";
import type { ActivityEvent } from "@/types/activity";
import { getStatus, STATUS_COLOR, STATUS_LABEL } from "@/lib/project-status";
import { getLocalProjectData } from "@/lib/projects";
import { getExecutionStatus } from "@/lib/reports";

/* ── TMP — média de finished_at-started_at das execuções conhecidas ── */
function useAvgProcessingTime(projects: Project[]): number | null {
  const [avgMs, setAvgMs] = useState<number | null>(null);

  const execKeys = useMemo(
    () =>
      projects
        .map((p) => {
          const local = getLocalProjectData(p.id);
          return local.reportId && local.executionId
            ? { reportId: local.reportId, executionId: local.executionId, projectId: p.id }
            : null;
        })
        .filter(
          (x): x is { reportId: string; executionId: string; projectId: string } => !!x,
        ),
    [projects],
  );

  useEffect(() => {
    if (execKeys.length === 0) return;
    let cancelled = false;
    Promise.allSettled(
      execKeys.map((k) => getExecutionStatus(k.reportId, k.executionId, k.projectId)),
    ).then((results) => {
      if (cancelled) return;
      const durations = results
        .filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getExecutionStatus>>> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value)
        .filter((e) => e.status === "READY" && e.started_at && e.finished_at)
        .map(
          (e) =>
            new Date(e.finished_at!).getTime() -
            new Date(e.started_at!).getTime(),
        )
        .filter((ms) => ms > 0);
      if (durations.length > 0)
        setAvgMs(durations.reduce((a, b) => a + b, 0) / durations.length);
    });
    return () => {
      cancelled = true;
    };
  }, [execKeys]);

  return avgMs;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 > 0 ? ` ${s % 60}s` : ""}`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

/* ── Donut ───────────────────────────────────────────────────── */
const DONUT_ORDER = ["active", "pending", "error", "empty"] as const;

/* Rótulos curtos — mesma linguagem dos filtros acima do painel */
const DONUT_LABEL: Record<(typeof DONUT_ORDER)[number], string> = {
  active: "Concluído",
  pending: "Processando",
  error: "Requer ação",
  empty: "Sem upload",
};

function StatusDonut({ projects }: { projects: Project[] }) {
  const counts = useMemo(() => {
    const c: Record<(typeof DONUT_ORDER)[number], number> = {
      active: 0,
      pending: 0,
      error: 0,
      empty: 0,
    };
    for (const p of projects) c[getStatus(p)]++;
    return c;
  }, [projects]);

  const total = projects.length;
  const r = 31;
  const stroke = 9;
  const circumference = 2 * Math.PI * r;
  const gap = total > 1 ? 2.5 : 0; // px de respiro entre segmentos

  const segments = DONUT_ORDER.reduce<
    { acc: number; items: { key: string; color: string; dasharray: string; dashoffset: number; label: string }[] }
  >(
    (state, key) => {
      if (counts[key] === 0) return state;
      const len = (counts[key] / total) * circumference;
      const visible = Math.max(len - gap, 1);
      return {
        acc: state.acc + len,
        items: [
          ...state.items,
          {
            key,
            color: STATUS_COLOR[key],
            dasharray: `${visible} ${circumference - visible}`,
            dashoffset: -state.acc,
            label: `${STATUS_LABEL[key]}: ${counts[key]}`,
          },
        ],
      };
    },
    { acc: 0, items: [] },
  ).items;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <svg
        width={80}
        height={80}
        viewBox="0 0 80 80"
        role="img"
        aria-label={`Status dos projetos: ${segments.map((s) => s.label).join(", ") || "nenhum projeto"}`}
      >
        <circle
          cx={40}
          cy={40}
          r={r}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={stroke}
        />
        {segments.map((s) => (
          <circle
            key={s.key}
            cx={40}
            cy={40}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            transform="rotate(-90 40 40)"
            className="insight-donut-seg"
          >
            <title>{s.label}</title>
          </circle>
        ))}
        <text
          x={40}
          y={40}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
            fontSize: "22px",
            fontWeight: 800,
            fill: "var(--text-default)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {total}
        </text>
      </svg>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "5px",
        }}
      >
        {DONUT_ORDER.map((key) => (
          <li
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              fontSize: "12.5px",
              fontWeight: 600,
              color:
                counts[key] > 0 ? "var(--text-secondary)" : "var(--text-muted)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "2px",
                background:
                  counts[key] > 0 ? STATUS_COLOR[key] : "var(--border-strong)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                minWidth: "14px",
                textAlign: "right",
              }}
            >
              {counts[key]}
            </span>
            {DONUT_LABEL[key]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Atividade · 14 dias ─────────────────────────────────────── */
const DAYS = 14;

function ActivityBars({ activities }: { activities: ActivityEvent[] }) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (DAYS - 1 - i));
      return { date: d, count: 0 };
    });
    for (const a of activities) {
      const t = new Date(a.created_at);
      t.setHours(0, 0, 0, 0);
      const idx = Math.round((t.getTime() - buckets[0].date.getTime()) / 86_400_000);
      if (idx >= 0 && idx < DAYS) buckets[idx].count++;
    }
    return buckets;
  }, [activities]);

  const max = Math.max(...days.map((d) => d.count), 1);

  return (
    <div
      role="img"
      aria-label={`Atividade nos últimos ${DAYS} dias: ${days.reduce((s, d) => s + d.count, 0)} eventos`}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "3px",
        height: "44px",
      }}
    >
      {days.map((d, i) => {
        const isToday = i === DAYS - 1;
        const label = `${d.date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} · ${d.count} ${d.count === 1 ? "evento" : "eventos"}`;
        return (
          <div
            key={d.date.toISOString()}
            title={label}
            className="insight-bar"
            style={{
              flex: 1,
              height: d.count > 0 ? `${Math.max((d.count / max) * 100, 12)}%` : "4px",
              borderRadius: "2px",
              background:
                d.count > 0
                  ? isToday
                    ? "var(--bg-accent)"
                    : "var(--bg-primary)"
                  : isToday
                    ? "color-mix(in oklch, var(--bg-accent) 45%, var(--border-default))"
                    : "var(--border-default)",
              cursor: "help",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Grid de siglas ──────────────────────────────────────────── */
interface KpiCell {
  sigla: string;
  value: string;
  desc: string;
  /** Cor semântica do valor (saúde da métrica). Omitido = neutro. */
  valueColor?: string;
}

function KpiGrid({ cells }: { cells: KpiCell[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
      }}
    >
      {cells.map((c) => (
        <div
          key={c.sigla}
          title={c.desc}
          style={{
            padding: "9px 12px",
            borderRadius: "7px",
            background: "var(--bg-tinted)",
            cursor: "help",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "var(--text-muted)",
            }}
          >
            {c.sigla}
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: c.valueColor ?? "var(--text-default)",
              fontVariantNumeric: "tabular-nums",
              marginTop: "1px",
              whiteSpace: "nowrap",
            }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Painel ──────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--text-muted)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

export function ProjectsInsights({
  projects,
  activities,
}: {
  projects: Project[];
  activities: ActivityEvent[];
}) {
  const avgMs = useAvgProcessingTime(projects);

  const totalRows = projects.reduce(
    (sum, p) => sum + (p.normalizedFile?.rows ?? p.uploadedFile?.rows ?? 0),
    0,
  );

  const done = activities.filter((a) => a.type === "processing_done").length;
  const failed = activities.filter((a) => a.type === "needs_action").length;
  const successRate =
    done + failed > 0 ? Math.round((done / (done + failed)) * 100) : null;

  const cells: KpiCell[] = [
    {
      sigla: "LPT",
      value: totalRows > 0 ? formatCompact(totalRows) : "—",
      desc: "Linhas Processadas Totais — soma de linhas dos arquivos de todos os projetos",
    },
    {
      sigla: "TXS",
      value: successRate !== null ? `${successRate}%` : "—",
      desc: "Taxa de Sucesso — processamentos concluídos vs. que exigiram ação, nas atividades recentes",
      valueColor:
        successRate === null
          ? undefined
          : successRate >= 85
            ? "var(--status-good)"
            : successRate >= 60
              ? "var(--status-warn)"
              : "var(--status-bad)",
    },
    {
      sigla: "TMP",
      value: avgMs !== null ? formatDuration(avgMs) : "—",
      desc: "Tempo Médio de Processamento — média de duração das últimas execuções concluídas",
    },
    {
      sigla: "TKP",
      /* TODO (backend): GET /api/projects/{id}/metrics — field: tokens_used */
      value: "—",
      desc: "Tokens por Projeto — média de tokens de IA gastos por projeto (aguardando métrica do backend)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <SectionLabel>Status dos projetos</SectionLabel>
      <StatusDonut projects={projects} />

      <div
        aria-hidden="true"
        style={{ height: "1px", background: "var(--border-default)", margin: "2px 0" }}
      />

      <SectionLabel>Atividade · {DAYS} dias</SectionLabel>
      <ActivityBars activities={activities} />

      <div
        aria-hidden="true"
        style={{ height: "1px", background: "var(--border-default)", margin: "2px 0" }}
      />

      <KpiGrid cells={cells} />
    </div>
  );
}
