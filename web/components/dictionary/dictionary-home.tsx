"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, X, BookOpen, Tag, Layers } from "lucide-react";
import type { DictionaryEntry, EntryKind, CreateEntryInput, UpdateEntryInput } from "@/types/dictionary";
import { useDictionary } from "@/hooks/use-dictionary";
import { formatRelativeDate } from "@/lib/format-date";
import { DictEditor } from "./dict-editor";

/* ── Kind config ─────────────────────────────────────────────── */
const KIND_CONFIG: Record<
  EntryKind,
  { label: string; color: string; Icon: React.ElementType }
> = {
  categories: { label: "Categorias", color: "#006b5a", Icon: Tag },
  context: { label: "Contexto IA", color: "#6b4cc7", Icon: BookOpen },
};

const FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "categories", label: "Categorias" },
  { value: "context", label: "Contexto IA" },
] as const;

type FilterValue = "all" | EntryKind;

/* ── Normalizer ──────────────────────────────────────────────── */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function matchesQuery(e: DictionaryEntry, q: string) {
  if (!q) return true;
  const n = norm(q);
  if (norm(e.name).includes(n)) return true;
  if (norm(e.description).includes(n)) return true;
  if (e.content && norm(e.content).includes(n)) return true;
  if (e.items?.some((i: string) => norm(i).includes(n))) return true;
  return false;
}

/* ── Previews ────────────────────────────────────────────────── */
function CategoriesPreview({ items }: { items: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || items.length === 0) return;

    function measure() {
      if (!el) return;
      const cw = el.offsetWidth;
      const chips = Array.from(el.querySelectorAll<HTMLElement>("[data-chip]"));
      const overflowEl = el.querySelector<HTMLElement>("[data-overflow]");
      const gap = 6;

      const savedDisplays = chips.map((c) => c.style.display);
      chips.forEach((c) => {
        c.style.display = "inline-flex";
      });

      let savedOvDisplay = "";
      if (overflowEl) {
        savedOvDisplay = overflowEl.style.display;
        overflowEl.style.display = "inline-flex";
        overflowEl.style.visibility = "hidden";
      }

      const ow = (overflowEl?.offsetWidth ?? 30) + gap;

      let used = 0;
      let count = 0;
      for (let i = 0; i < chips.length; i++) {
        const w = chips[i].offsetWidth;
        const used2 = used + (i > 0 ? gap : 0) + w;
        const isLast = i === chips.length - 1;
        if (!isLast && used2 + ow > cw) break;
        if (isLast && used2 > cw) break;
        used = used2;
        count++;
      }

      chips.forEach((c, i) => {
        c.style.display = savedDisplays[i];
      });
      if (overflowEl) {
        overflowEl.style.display = savedOvDisplay;
        overflowEl.style.visibility = "";
      }

      setVisibleCount(Math.max(1, count));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items]);

  const overflow = items.length - visibleCount;

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        gap: "6px",
        overflow: "hidden",
        flexWrap: "nowrap",
      }}
    >
      {items.map((item, i) => (
        <span
          key={i}
          data-chip=""
          style={{
            display: i < visibleCount ? "inline-flex" : "none",
            alignItems: "center",
            padding: "3px 9px",
            background: "transparent",
            border: "1px solid var(--border-strong)",
            color: "var(--text-secondary)",
            borderRadius: "3px",
            fontSize: "12px",
            fontWeight: 400,
            lineHeight: 1.4,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {item}
        </span>
      ))}
      <span
        data-overflow=""
        style={{
          display: overflow > 0 ? "inline-flex" : "none",
          alignItems: "center",
          padding: "3px 9px",
          background: "transparent",
          border: "1px solid var(--border-default)",
          color: "var(--text-muted)",
          borderRadius: "3px",
          fontSize: "12px",
          fontWeight: 400,
          lineHeight: 1.4,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        +{overflow}
      </span>
    </div>
  );
}

function ContextPreview({ content }: { content: string }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: "13px",
        fontStyle: "normal",
        color: "var(--text-secondary)",
        lineHeight: 1.6,
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        background: "oklch(45% 0.17 295 / 0.045)",
        borderRadius: "6px",
        padding: "10px 13px",
      }}
    >
      {content}
    </p>
  );
}

/* ── Card ────────────────────────────────────────────────────── */
function DictCard({
  entry,
  onOpen,
}: {
  entry: DictionaryEntry;
  onOpen: (e: DictionaryEntry) => void;
}) {
  const cfg = KIND_CONFIG[entry.kind];
  const usedCount = entry.usedIn.length;

  return (
    <article
      className={`dict-card dict-card--${entry.kind}`}
      onClick={() => onOpen(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(entry);
        }
      }}
      aria-label={`Editar entrada: ${entry.name}`}
    >
      {/* Head: badge + hover edit button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "4px 10px",
            background: `${cfg.color}1e`,
            color: cfg.color,
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          <cfg.Icon size={11} strokeWidth={2.3} aria-hidden="true" />
          {cfg.label}
        </span>
        <div className="dict-card__actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(entry);
            }}
            aria-label={`Editar ${entry.name}`}
            style={{
              padding: "4px 12px",
              border: `1px solid ${cfg.color}38`,
              borderRadius: "6px",
              background: `${cfg.color}0e`,
              color: cfg.color,
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Editar
          </button>
        </div>
      </div>

      {/* Title */}
      <h3
        style={{
          margin: "0 0 7px",
          fontSize: "17px",
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--text-default)",
          lineHeight: 1.2,
        }}
      >
        {entry.name}
      </h3>

      {/* Desc */}
      <p
        style={
          {
            margin: "0 0 14px",
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          } as React.CSSProperties
        }
      >
        {entry.description}
      </p>

      {/* Body — kind preview */}
      <div style={{ paddingBottom: "14px" }}>
        {entry.kind === "categories" && entry.items && (
          <CategoriesPreview items={entry.items} />
        )}
        {entry.kind === "context" && entry.content && (
          <ContextPreview content={entry.content} />
        )}
      </div>

      {/* Foot */}
      <div
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--border-default)",
          paddingTop: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            minWidth: 0,
          }}
        >
          {usedCount === 0 ? (
            "Não aplicada"
          ) : (
            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
              {usedCount} projeto{usedCount !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          {formatRelativeDate(entry.updatedAt)}
        </span>
      </div>
    </article>
  );
}

/* ── Aside ───────────────────────────────────────────────────── */
function DictAside({ entries }: { entries: DictionaryEntry[] }) {
  const totalApplications = entries.reduce((s, e) => s + e.usedIn.length, 0);
  const unusedCount = entries.filter((e) => e.usedIn.length === 0).length;
  const mostUsed = [...entries]
    .sort((a, b) => b.usedIn.length - a.usedIn.length)
    .slice(0, 4);

  const asideCard: React.CSSProperties = {
    background: "var(--box-bg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "8px",
    padding: "20px",
  };

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        alignSelf: "start",
        position: "sticky",
        top: "24px",
      }}
    >
      {/* Resumo */}
      <div className="dict-aside-card" style={asideCard}>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "12px",
          }}
        >
          Resumo
        </span>
        {[
          { label: "Total de entradas", val: entries.length },
          { label: "Aplicações em projetos", val: totalApplications },
          { label: "Sem aplicação", val: unusedCount },
        ].map(({ label, val }) => (
          <div key={label} className="dict-stat-row">
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 400,
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--text-default)",
                fontSize: "13px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {val}
            </span>
          </div>
        ))}
      </div>

      {/* Mais reutilizadas */}
      <div className="dict-aside-card" style={asideCard}>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "12px",
          }}
        >
          Mais reutilizadas
        </span>
        {mostUsed.filter((e) => e.usedIn.length > 0).length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 400,
              color: "var(--text-muted)",
            }}
          >
            Nenhuma aplicada ainda.
          </p>
        ) : (
          mostUsed
            .filter((e) => e.usedIn.length > 0)
            .map((entry) => {
              const cfg = KIND_CONFIG[entry.kind];
              return (
                <div key={entry.id} className="dict-topused-item">
                  <cfg.Icon
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    style={{ color: cfg.color, flexShrink: 0 }}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--text-default)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1.35,
                    }}
                  >
                    {entry.name}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {entry.usedIn.length}
                  </span>
                </div>
              );
            })
        )}
      </div>

      {/* Como aplicar */}
      <div className="dict-aside-card" style={asideCard}>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Como aplicar
        </span>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          Abra a configuração de uma coluna em qualquer projeto e selecione uma
          entrada do dicionário para aplicá-la automaticamente.
        </p>
      </div>
    </aside>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function DictionaryHome() {
  const { entries, loading, error, create, update, remove } = useDictionary({
    kind: "global",
  });
  const [filter, setFilter] = useState<FilterValue>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DictionaryEntry | null | "new">(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(
    () => ({
      all: entries.length,
      categories: entries.filter((e) => e.kind === "categories").length,
      context: entries.filter((e) => e.kind === "context").length,
    }),
    [entries],
  );

  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      return matchesQuery(e, query);
    });
  }, [entries, filter, query]);

  async function handleSave(
    input: CreateEntryInput | UpdateEntryInput,
    entryId?: string,
  ) {
    if (entryId) {
      await update(entryId, input as UpdateEntryInput);
    } else {
      await create(input as CreateEntryInput);
    }
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await remove(id);
    setEditing(null);
  }

  function openNew() {
    setEditing("new");
  }

  const editingEntry = editing === "new" ? null : editing;
  const isEditorOpen = editing !== null;

  return (
    <>
      <div
        className="dashboard-page-bg scroll-styled"
        style={{
          flex: 1,
          overflowY: "auto",
          height: "100%",
        }}
      >
        <div
          style={{
            maxWidth: "1240px",
            margin: "0 auto",
            padding: "52px 44px 88px",
          }}
        >
          {/* Header */}
          <header style={{ marginBottom: "28px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "24px",
              }}
            >
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--primary-700)",
                    marginBottom: "8px",
                  }}
                >
                  Dicionário global
                </span>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "36px",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.1,
                    color: "var(--text-default)",
                    fontFamily: "var(--font-space-grotesk)",
                  }}
                >
                  Suas preferências.
                </h1>
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "15px",
                    fontWeight: 400,
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                    maxWidth: "480px",
                  }}
                >
                  Categorias e instruções salvas para reutilização.
                </p>
              </div>
              <button
                className="btn-cta"
                onClick={openNew}
                style={{ marginTop: "4px" }}
              >
                <Layers size={15} strokeWidth={2.2} aria-hidden="true" />
                Nova entrada
              </button>
            </div>
          </header>

          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "32px",
              flexWrap: "wrap",
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar entradas"
                aria-label="Buscar entradas no dicionário"
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: query ? "32px" : "12px",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  fontSize: "14px",
                  border:
                    "1px solid color-mix(in oklch, var(--bg-tinted) 95%, black)",
                  borderRadius: "8px",
                  background: "var(--bg-tinted)",
                  color: "var(--text-default)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "box-shadow 150ms ease, border-color 150ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow =
                    "inset 0 0 0 1.5px color-mix(in oklch, var(--bg-tinted) 90%, black)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Limpar pesquisa"
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

            {/* Segmented filter */}
            <div
              role="tablist"
              aria-label="Filtrar por tipo"
              style={{
                display: "flex",
                gap: "2px",
                background: "var(--bg-tinted)",
                borderRadius: "8px",
                padding: "3px",
              }}
            >
              {FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.value;
                const count = counts[opt.value];
                return (
                  <button
                    key={opt.value}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(opt.value)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: active ? 700 : 500,
                      background: active ? "var(--bg-surface)" : "transparent",
                      color: active
                        ? "var(--text-default)"
                        : "var(--text-muted)",
                      cursor: "pointer",
                      boxShadow: active ? "var(--box-shadow)" : "none",
                      transition: "background 150ms ease, color 150ms ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    {opt.label}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: active ? 700 : 500,
                        padding: "1px 5px",
                        borderRadius: "99px",
                        background: active
                          ? "rgba(0,107,90,0.12)"
                          : "transparent",
                        color: active ? "#006b5a" : "var(--text-muted)",
                        fontVariantNumeric: "tabular-nums",
                        transition: "background 150ms ease, color 150ms ease",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 288px",
              gap: "40px",
              alignItems: "start",
            }}
          >
            {/* Cards grid */}
            <div>
              {loading ? (
                <div style={{ padding: "64px 0", textAlign: "center" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Carregando entradas…
                  </p>
                </div>
              ) : error ? (
                <div style={{ padding: "64px 0", textAlign: "center" }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--text-default)",
                    }}
                  >
                    Erro ao carregar
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "var(--text-muted)",
                    }}
                  >
                    {error.message}
                  </p>
                </div>
              ) : visible.length === 0 ? (
                <div style={{ padding: "64px 0", textAlign: "center" }}>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--text-default)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {query
                      ? `"${query}"`
                      : filter !== "all"
                        ? FILTER_OPTIONS.find((o) => o.value === filter)?.label
                        : "Dicionário vazio"}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 400,
                      color: "var(--text-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {query
                      ? "Nenhuma entrada encontrada para este termo."
                      : "Nenhuma entrada neste filtro."}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "16px",
                    maxWidth: "1200px",
                  }}
                >
                  {visible.map((entry) => (
                    <DictCard
                      key={entry.id}
                      entry={entry}
                      onOpen={(e) => setEditing(e)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Aside */}
            <DictAside entries={entries} />
          </div>
        </div>
      </div>

      {/* Editor modal */}
      {isEditorOpen && (
        <DictEditor
          entry={editingEntry}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
