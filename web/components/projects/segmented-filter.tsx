import { FILTERS, type FilterValue } from "@/lib/project-status";

interface Props {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  orientation?: "horizontal" | "vertical";
  counts?: Partial<Record<FilterValue, number>>;
}

export function SegmentedFilter({
  value,
  onChange,
  orientation = "horizontal",
  counts,
}: Props) {
  if (orientation === "vertical") {
    return (
      <div
        role="group"
        aria-label="Filtrar projetos"
        style={{ display: "flex", flexDirection: "column", gap: "2px" }}
      >
        {FILTERS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                fontSize: "15px",
                textAlign: "left",
                fontWeight: active ? 700 : 600,
                background: active ? "var(--bg-tinted)" : "transparent",
                color: active ? "var(--text-default)" : "var(--text-muted)",
                cursor: "pointer",
                transition: "background 150ms ease, color 150ms ease",
              }}
            >
              <span>{opt.label}</span>
              {counts?.[opt.value] !== undefined && (
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: active ? "var(--text-secondary)" : "var(--text-muted)",
                  }}
                >
                  {counts[opt.value]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Filtrar projetos"
      style={{
        display: "flex",
        gap: "2px",
        background: "var(--bg-tinted)",
        borderRadius: "8px",
        padding: "3px",
      }}
    >
      {FILTERS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            padding: "5px 14px",
            borderRadius: "6px",
            border: "none",
            fontSize: "15px",
            fontWeight: value === opt.value ? 700 : 600,
            background: value === opt.value ? "var(--bg-surface)" : "transparent",
            color: value === opt.value ? "var(--text-default)" : "var(--text-muted)",
            cursor: "pointer",
            boxShadow: value === opt.value ? "var(--box-shadow)" : "none",
            transition: "background 150ms ease, color 150ms ease",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
