"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export interface TaskCardProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function TaskCard({ id, label, checked, onChange }: TaskCardProps) {
  const [hovered, setHovered] = useState(false);

  const bg = checked
    ? hovered ? "var(--task-card-checked-bg-hover)" : "var(--task-card-checked-bg)"
    : hovered ? "var(--task-card-bg-hover)" : "var(--task-card-bg)";

  const border = checked
    ? "var(--task-card-checked-border)"
    : hovered ? "var(--task-card-border-hover)" : "var(--task-card-border)";

  return (
    <label
      htmlFor={id}
      onClick={() => onChange(!checked)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 18px",
        borderRadius: "8px",
        border: `1.5px solid ${border}`,
        background: bg,
        cursor: "pointer",
        transition: "border-color 220ms ease, background 220ms ease",
        userSelect: "none",
      }}
    >
      <div
        role="checkbox"
        id={id}
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "4px",
          border: `1.5px solid ${checked ? "var(--task-card-checked-box-bd)" : "var(--task-card-border-hover)"}`,
          background: checked ? "var(--task-card-checked-box-bg)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 150ms ease, border-color 150ms ease",
        }}
      >
        {checked && <Check size={10} strokeWidth={3} style={{ color: "var(--task-card-checked-check)" }} />}
      </div>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: checked ? "var(--task-card-checked-text)" : "var(--text-default)",
          transition: "color 150ms ease",
        }}
      >
        {label}
      </span>
    </label>
  );
}
