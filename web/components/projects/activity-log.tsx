import Link from "next/link";
import { ACTIVITY_CONFIG } from "@/lib/activity-data";
import { formatRelativeDate } from "@/lib/format-date";
import type { ActivityEvent } from "@/types/activity";

const ACTIVITY: ActivityEvent[] = [
  { id: "1", type: "processing_start", project_name: "Maus Tratos",                project_id: "1", created_at: "2026-06-01T19:45:00Z" },
  { id: "2", type: "needs_action",     project_name: "Crimes Contra o Patrimônio", project_id: "3", created_at: "2026-06-01T17:00:00Z" },
  { id: "3", type: "upload",           project_name: "Crimes Contra o Patrimônio", project_id: "3", created_at: "2026-05-18T08:00:00Z" },
  { id: "4", type: "project_created",  project_name: "Violência Doméstica",        project_id: "4", created_at: "2026-05-18T00:00:00Z" },
  { id: "5", type: "processing_done",  project_name: "Improbidade Administrativa", project_id: "2", created_at: "2026-05-17T14:30:00Z" },
  { id: "6", type: "upload",           project_name: "Improbidade Administrativa", project_id: "2", created_at: "2026-05-17T14:00:00Z" },
  { id: "7", type: "processing_done",  project_name: "Maus Tratos a Animais",      project_id: "1", created_at: "2026-05-16T10:00:00Z" },
  { id: "8", type: "project_created",  project_name: "Crimes Contra o Patrimônio", project_id: "3", created_at: "2026-05-10T00:00:00Z" },
];

export function ActivityLog() {
  return (
    <aside
      style={{
        width: "300px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <span
        style={{
          fontSize: "14px",
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          display: "block",
          marginBottom: "16px",
          flexShrink: 0,
        }}
      >
        Atividade recente
      </span>

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
        {ACTIVITY.map((event, i) => {
          const cfg = ACTIVITY_CONFIG[event.type];
          return (
            <li key={event.id}>
              <Link
                href={`/projects/${event.project_id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 0",
                  textDecoration: "none",
                  borderBottom: i < ACTIVITY.length - 1 ? "1px solid var(--border-default)" : "none",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    background: `${cfg.color}18`,
                    color: cfg.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  <cfg.Icon size={14} strokeWidth={2} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "3px" }}>
                    {cfg.label}
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--text-default)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {event.project_name}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginTop: "3px" }}>
                    {formatRelativeDate(event.created_at)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
