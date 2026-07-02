"use client";

const RULES = [
  { label: "Mínimo de 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Uma letra maiúscula [A-Z]", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Um número ou símbolo", test: (p: string) => /[\d!@#$%^&*()_+\-=[\]{}|;:',.<>?]/.test(p) },
];

export function PasswordStrength({
  password,
  dark,
}: {
  password: string;
  dark: boolean;
}) {
  const met = RULES.filter((r) => r.test(password)).length;
  const empty = !password;

  const level = met <= 1 ? "fraca" : met === 2 ? "média" : "forte";
  const levelColor = { fraca: "#ef4444", média: "#f59e0b", forte: "#22c55e" }[level];
  const levelLabel = { fraca: "Fraca", média: "Média", forte: "Forte" }[level];
  const accent = empty ? (dark ? "#2ec98d" : "#15a37b") : levelColor;
  const track = dark ? "#242424" : "#e4ede9";
  const textMet = dark ? "#2ec98d" : "#15a37b";
  const textUnmet = dark ? "#444" : "#b0bdb9";

  // 3 discrete segments — one per rule
  return (
    <div className="mt-3 space-y-3">
      {/* Segmented bar + strength label */}
      <div className="flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {RULES.map((_, i) => {
          const active = !empty && i < met;
          return (
            <div
              key={i}
              className="flex-1 h-[5px] rounded-sm overflow-hidden"
              style={{ background: track }}
            >
              <div
                className="h-full w-full rounded-sm"
                style={{
                  background: accent,
                  transform: active ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform 350ms cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>
          );
        })}
      </div>
      {!empty && (
        <span
          className="text-[11px] font-semibold shrink-0 w-9 text-right transition-colors duration-200"
          style={{ color: levelColor }}
          aria-live="polite"
        >
          {levelLabel}
        </span>
      )}
      </div>

      {/* Rules */}
      <ul className="space-y-1.5" role="list" aria-label="Requisitos da senha">
        {RULES.map((r) => {
          const ok = !empty && r.test(password);
          return (
            <li
              key={r.label}
              className="flex items-center gap-2.5 text-[12px] font-medium transition-colors duration-200"
              style={{ color: ok ? textMet : textUnmet }}
            >
              <span
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: `1.5px solid ${ok ? accent : dark ? "#333" : "#d1dbd7"}`,
                  background: ok ? accent : "transparent",
                  transition: "background 250ms ease, border-color 250ms ease",
                }}
              >
                {ok && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path
                      d="M1.5 4l2 2 3-3"
                      stroke={dark ? "#0a0a0a" : "#f0fdf9"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
