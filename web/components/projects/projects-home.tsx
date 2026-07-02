"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { NewProjectButton } from "./new-project-button";
import { type FilterValue, getStatus, FILTERS } from "@/lib/project-status";
import { useProjects } from "@/hooks/use-projects";
import { useActivities } from "@/hooks/use-activities";
import { useAuth } from "@/contexts/AuthContext";
import { useSeenProjects } from "@/lib/seen-projects";
import { SegmentedFilter } from "./segmented-filter";
import { ProjectRow } from "./project-row";
import { ProjectsInsights } from "./projects-insights";
import { NotificationBell } from "./notification-bell";
import { useToast } from "@/components/ui/toast";
import type { Project } from "@/types/project";
import type { ActivityType } from "@/types/activity";

/** Overlays activity-derived status onto a project when localStorage is stale.
 *  Backend project data always wins (normalizedFile, hasError already set). */
function enrichFromActivity(p: Project, latest?: ActivityType): Project {
  if (!latest || p.normalizedFile) return p;
  if (latest === "needs_action")     return { ...p, hasError: true };
  if (latest === "processing_start") return { ...p, processStatus: "processing" };
  return p;
}

export function ProjectsHome() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const { show: showToast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { isNew, markSeen } = useSeenProjects();
  const { projects, total, loading } = useProjects();

  /* Fase B — derive project status from activities when localStorage is stale */
  /* limit 50 — máximo aceito pelo backend (422 acima disso) */
  const { activities: activityFeed } = useActivities(50);
  const activityStatusMap = useMemo(() => {
    const map = new Map<string, ActivityType>();
    // activities are DESC sorted — first match per project_id is the latest
    for (const a of activityFeed) {
      if (!map.has(a.project_id)) map.set(a.project_id, a.type);
    }
    return map;
  }, [activityFeed]);

  useEffect(() => {
    const msg = sessionStorage.getItem("projects-toast");
    if (msg) {
      sessionStorage.removeItem("projects-toast");
      showToast(msg);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enriched = useMemo(
    () => projects.map((p) => enrichFromActivity(p, activityStatusMap.get(p.id))),
    [projects, activityStatusMap],
  );

  const filterCounts = useMemo(() => {
    const counts: Partial<Record<FilterValue, number>> = {
      all: enriched.length,
      active: 0,
      pending: 0,
      error: 0,
    };
    for (const p of enriched) {
      const s = getStatus(p);
      if (s === "active" || s === "pending" || s === "error") {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    return counts;
  }, [enriched]);

  const filtered = enriched
    .filter((p) => {
      if (filter !== "all" && getStatus(p) !== filter) return false;
      if (search.trim()) {
        const normalize = (s: string) =>
          s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        const q = normalize(search);
        return (
          normalize(p.title).includes(q) || normalize(p.description).includes(q)
        );
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const totalProjects = total;
  const withReport = projects.filter((p) => p.normalizedFile !== null).length;
  const totalNormalizations = projects.reduce((sum, p) => sum + p.normalizations, 0);
  const totalClassifications = projects.reduce((sum, p) => sum + p.classifications, 0);

  const statsLine = [
    { value: String(totalProjects), label: "Projetos" },
    { value: String(withReport), label: "Concluídos" },
    {
      value:
        totalNormalizations >= 1000
          ? `${(totalNormalizations / 1000).toFixed(1)}k`
          : String(totalNormalizations),
      label: "Normalizações",
    },
    {
      value:
        totalClassifications >= 1000
          ? `${(totalClassifications / 1000).toFixed(1)}k`
          : String(totalClassifications),
      label: "Classificações",
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          padding: "60px 100px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ margin: 0 }}>Carregando projetos…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "1600px",
        margin: "0 auto",
        padding: "60px 32px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "14px",
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: "48px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: "var(--text-default)",
            margin: 0,
          }}
        >
          Olá, {user?.name ?? "você"}
        </h1>
        <NewProjectButton />
      </header>

      {/* Stats bar */}
      <div
        style={{
          borderTop: "1px solid var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
          padding: "15px 0",
          marginBottom: "30px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          gap: 0,
        }}
      >
        {statsLine.map((s, i) => (
          <span
            key={s.label}
            style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
          >
            {i > 0 && (
              <span
                style={{
                  color: "var(--border-strong)",
                  margin: "0 16px",
                  fontWeight: 400,
                  fontSize: "15px",
                  userSelect: "none",
                }}
              >
                ·
              </span>
            )}
            <span
              style={{
                fontFamily: "var(--font-archivo, 'Archivo', sans-serif)",
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--text-default)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.value}
            </span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: "var(--text-secondary)",
              }}
            >
              {s.label}
            </span>
          </span>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <NotificationBell />
        </div>
      </div>

      {/* Two-column layout — fills remaining height */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left — project list */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "10px",
              flexShrink: 0,
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", width: "260px" }}>
              <Search
                size={14}
                strokeWidth={2}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar projetos"
                aria-label="Buscar projeto"
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: search ? "32px" : "12px",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  fontSize: "15px",
                  border: "1px solid color-mix(in oklch, var(--bg-tinted) 92%, black)",
                  borderRadius: "8px",
                  background: "var(--bg-tinted)",
                  color: "var(--text-default)",
                  outline: "none",
                  transition: "box-shadow 150ms ease",
                  boxSizing: "border-box",
                  boxShadow: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow =
                    "inset 0 0 0 1.5px color-mix(in oklch, var(--bg-tinted) 95%, black)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: "3px",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {filter === "all" && !search ? (
                /* Zero projects */
                <div style={{ textAlign: "center", maxWidth: "320px" }}>
                  <div style={{ width: "32px", height: "4px", background: "var(--bg-primary)", borderRadius: "2px", margin: "0 auto 20px" }} />
                  <p style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-default)", margin: "0 0 10px", lineHeight: 1.15 }}>
                    Nenhum projeto ainda.
                  </p>
                  <p style={{ fontSize: "15px", fontWeight: 400, color: "var(--text-secondary)", margin: "0 0 28px", lineHeight: 1.5 }}>
                    Configure um projeto para normalizar dados judiciais em escala.
                  </p>
                  <NewProjectButton />
                </div>
              ) : (
                /* No search/filter results */
                <div style={{ textAlign: "center", maxWidth: "320px" }}>
                  <p style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-default)", margin: "0 0 8px" }}>
                    {search
                      ? `"${search}"`
                      : `"${FILTERS.find(f => f.value === filter)?.label ?? filter}"`}
                  </p>
                  <p style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)", margin: 0 }}>
                    Nenhum projeto encontrado.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <ul
              className="scroll-styled"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                overflowY: "auto",
                flex: 1,
                paddingRight: "4px",
              }}
            >
              {filtered.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  isNew={isNew(p.id)}
                  onSeen={() => markSeen(p.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Vertical divider */}
        <div
          aria-hidden="true"
          style={{
            width: "1px",
            background: "var(--border-default)",
            alignSelf: "stretch",
            flexShrink: 0,
            margin: "0 28px",
          }}
        />

        {/* Right — filters */}
        <aside
          className="scroll-styled"
          style={{
            width: "232px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            overflowY: "auto",
            minHeight: 0,
            paddingRight: "2px",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-muted)",
              margin: "0 0 2px",
              padding: "0 12px",
            }}
          >
            Filtrar por status
          </p>
          <SegmentedFilter
            value={filter}
            onChange={setFilter}
            orientation="vertical"
            counts={filterCounts}
          />

          <div
            aria-hidden="true"
            style={{
              height: "1px",
              background: "var(--border-default)",
              margin: "14px 0",
            }}
          />

          <ProjectsInsights projects={enriched} activities={activityFeed} />
        </aside>

      </div>

    </div>
  );
}
