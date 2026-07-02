"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

/* ── Types ───────────────────────────────────────────────────── */

interface ToastEntry {
  id: string;
  message: string;
  issues?: string[];
  duration: number;
}

interface ToastContextValue {
  show: (message: string, opts?: { issues?: string[]; duration?: number }) => void;
}

/* ── Context ─────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

/* ── Internal item ───────────────────────────────────────────── */

const ITEM_STYLE: React.CSSProperties = {
  background: "oklch(18% 0.04 165)",
  border: "1px solid rgba(0,107,90,0.3)",
  borderRadius: "10px",
  boxShadow: "0 6px 24px rgba(0,0,0,0.32)",
  minWidth: "264px",
  maxWidth: "340px",
  pointerEvents: "auto",
};

function ToastItem({
  message,
  issues,
  duration,
  onDismiss,
}: Omit<ToastEntry, "id"> & { onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  const hasIssues = issues && issues.length > 0;
  const isMultiIssue = hasIssues && issues!.length > 1;

  const fadeDelay = Math.max(0, duration - 1000);
  const animStyle: React.CSSProperties = {
    animation: `tag-pop 170ms cubic-bezier(0.16,1,0.3,1), toast-out 1000ms ease-in ${fadeDelay}ms forwards`,
  };

  useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(t);
  }, [duration]);

  const dismissBtn = (
    <button
      onClick={onDismiss}
      aria-label="Fechar aviso"
      style={{
        background: "none",
        border: "none",
        padding: "2px",
        cursor: "pointer",
        color: "oklch(55% 0.04 165)",
        flexShrink: 0,
        display: "flex",
      }}
    >
      <X size={13} strokeWidth={2} />
    </button>
  );

  if (!isMultiIssue) {
    return (
      <div role="status" aria-live="polite" style={{ ...ITEM_STYLE, ...animStyle }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "12px 16px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              color: "oklch(88% 0.04 165)",
              fontWeight: 500,
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {hasIssues ? issues![0] : message}
          </span>
          {dismissBtn}
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" style={{ ...ITEM_STYLE, ...animStyle }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          gap: "8px",
        }}
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            gap: "6px",
            textAlign: "left",
            padding: 0,
          }}
        >
          <span
            style={{
              fontSize: "13px",
              color: "oklch(88% 0.04 165)",
              fontWeight: 500,
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {message}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={2}
            style={{
              color: "oklch(55% 0.04 165)",
              flexShrink: 0,
              transition: "transform 180ms ease",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
        {dismissBtn}
      </div>

      {expanded && (
        <ul
          style={{
            margin: 0,
            padding: "0 16px 12px 16px",
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          {issues!.map((issue) => (
            <li
              key={issue}
              style={{
                fontSize: "12px",
                color: "oklch(68% 0.04 165)",
                lineHeight: 1.4,
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
              }}
            >
              <span style={{ color: "oklch(52% 0.12 165)", flexShrink: 0, marginTop: "1px" }}>·</span>
              {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Provider ────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const show = useCallback(
    (message: string, opts?: { issues?: string[]; duration?: number }) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      setToasts((prev) => [
        ...prev,
        { id, message, issues: opts?.issues, duration: opts?.duration ?? 3500 },
      ]);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {mounted &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: "24px",
              right: "24px",
              zIndex: 500,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              pointerEvents: "none",
            }}
          >
            {toasts.map((t) => (
              <ToastItem
                key={t.id}
                message={t.message}
                issues={t.issues}
                duration={t.duration}
                onDismiss={() => dismiss(t.id)}
              />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/* ── Hook ────────────────────────────────────────────────────── */

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
