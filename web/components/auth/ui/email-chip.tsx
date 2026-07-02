"use client";

import { Mail } from "lucide-react";
import { linkClass } from "../utils/auth-styles";

interface EmailChipProps {
  email: string;
  dark: boolean;
  onAlterar: () => void;
}

/** Compact read-only email display shown after the code is sent. */
export function EmailChip({ email, dark, onAlterar }: EmailChipProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        borderRadius: "8px",
        border: `1px solid ${dark ? "#2a2a2a" : "#b8d9d0"}`,
        background: dark ? "#141414" : "#f0fdf9",
      }}
    >
      <Mail
        size={14}
        style={{ color: dark ? "#2ec98d" : "#15a37b", flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: "14px",
          color: dark ? "#c8c8c8" : "#1b3630",
          flex: 1,
          fontWeight: 500,
        }}
      >
        {email}
      </span>
      <button
        type="button"
        onClick={onAlterar}
        className={linkClass(dark)}
        style={{ fontSize: "13px" }}
      >
        Alterar
      </button>
    </div>
  );
}
