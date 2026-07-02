"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { ACTIVITY_CONFIG } from "@/lib/activity-data";
import { formatRelativeDate } from "@/lib/format-date";
import { useActivities } from "@/hooks/use-activities";
import { useSeenNotifications } from "@/lib/seen-notifications";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Poll every 30 s so the badge updates without a page reload */
  const { activities, loading, error } = useActivities(20, 0, 30_000);
  const { markSeen, clearAll, hasNew, visibleActivities } = useSeenNotifications();

  const allRecent  = activities.slice(0, 8);
  const visibleList = visibleActivities(allRecent);

  /* Dot: shows when any activity arrived after the last panel open */
  const hasDot  = hasNew(activities);
  const dotColor = activities.some((e) => e.type === "needs_action")
    ? "#f59e0b"
    : activities.some((e) => e.type === "processing_start")
      ? "#06b6d4"
      : "oklch(55% 0.14 165)";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
      markSeen();
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Notificações"
        aria-expanded={open}
        style={{
          position: "relative",
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          border: "none",
          background: open ? "var(--bg-tinted)" : "transparent",
          color: open ? "var(--text-default)" : "var(--text-secondary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = "var(--bg-tinted)";
            e.currentTarget.style.color = "var(--text-default)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
          }
        }}
      >
        <Bell size={22} strokeWidth={1.6} />
        {hasDot && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "7px",
              height: "7px",
            }}
          >
            {/* Expanding ring */}
            <span
              className="bell-dot-ring"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: dotColor,
              }}
            />
            {/* Solid dot */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: dotColor,
                border: "1.5px solid var(--bg-page, var(--bg-base))",
              }}
            />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notificações recentes"
          style={{
            position: "fixed",
            top: panelPos.top,
            right: panelPos.right,
            zIndex: 500,
            width: "340px",
            background: "var(--bg-surface, var(--bg-base))",
            border: "1px solid var(--border-default)",
            borderRadius: "14px",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.07), 0 16px 40px -4px rgba(0,0,0,0.12)",
            overflow: "hidden",
            animation: "sb-panel-in 180ms cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "13px 16px 11px",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-default)",
              }}
            >
              Notificações
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-muted)",
              }}
            >
              {visibleList.length} recentes
            </span>
          </div>

          {/* List */}
          {loading && (
            <div
              style={{
                padding: "24px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Carregando…
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Não foi possível carregar as notificações.
            </div>
          )}

          {!loading && !error && visibleList.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Nenhuma atividade recente.
            </div>
          )}

          {!loading && !error && visibleList.length > 0 && (
            <ul
              className="scroll-styled"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                maxHeight: "360px",
                overflowY: "auto",
              }}
            >
              {visibleList.map((event, i) => {
                const cfg = ACTIVITY_CONFIG[event.type];
                const isAlert =
                  event.type === "needs_action" ||
                  event.type === "processing_start";
                return (
                  <li key={event.id}>
                    <Link
                      href={`/projects/${event.project_id}`}
                      onClick={() => setOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "11px",
                        padding: "11px 16px",
                        textDecoration: "none",
                        borderBottom:
                          i < visibleList.length - 1
                            ? "1px solid var(--border-default)"
                            : "none",
                        background: isAlert
                          ? `color-mix(in oklch, ${cfg.color} 4%, transparent)`
                          : "transparent",
                        transition: "background 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--bg-tinted)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isAlert
                          ? `color-mix(in oklch, ${cfg.color} 4%, transparent)`
                          : "transparent";
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "8px",
                          background: `${cfg.color}1a`,
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

                      {/* Text */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            marginBottom: "2px",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {cfg.label}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "var(--text-default)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {event.project_name}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                            marginTop: "2px",
                          }}
                        >
                          {formatRelativeDate(event.created_at)}
                        </div>
                      </div>

                      {/* Alert dot */}
                      {isAlert && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: cfg.color,
                            flexShrink: 0,
                            marginTop: "12px",
                          }}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer — clear button */}
          {!loading && !error && visibleList.length > 0 && (
            <div
              style={{
                padding: "9px 16px",
                borderTop: "1px solid var(--border-default)",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <button
                onClick={() => { clearAll(); setOpen(false); }}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  borderRadius: "6px",
                  transition: "color 120ms ease, background 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.background = "var(--bg-tinted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "none";
                }}
              >
                Limpar notificações
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
