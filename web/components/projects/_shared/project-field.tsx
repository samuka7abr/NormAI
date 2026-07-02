"use client";

import React, { useState } from "react";

export interface ProjectFieldProps {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
}

export function ProjectField({ label, hint, icon, value, onChange, minRows = 3 }: ProjectFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--primary-700)",
          marginBottom: "10px",
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          borderBottom: `1.5px solid ${focused ? "var(--primary-700)" : "var(--border-default)"}`,
          transition: "border-color 150ms ease",
          paddingBottom: "4px",
        }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint}
          rows={minRows}
          className="new-project-field"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            resize: "none",
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: "15px",
            lineHeight: 1.65,
            color: "var(--text-default)",
            fontFamily: "inherit",
            boxSizing: "border-box",
            padding: 0,
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
