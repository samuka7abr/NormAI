"use client";

export function CustomCheckbox({
  id,
  checked,
  onChange,
  label,
  dark,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  dark: boolean;
}) {
  const borderColor = dark
    ? checked ? "#9dffa1" : "#3a3a3a"
    : checked ? "#15a37b" : "#b8d9d0";
  const fillColor = dark ? "#9dffa1" : "#15a37b";
  const labelColor = dark ? "text-[#888]" : "text-[#555]";

  return (
    <label
      htmlFor={id}
      className={"flex items-center gap-2.5 cursor-pointer select-none group " + labelColor}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 5,
          flexShrink: 0,
          border: `1.5px solid ${borderColor}`,
          background: checked ? fillColor : "transparent",
          transition: "background 200ms ease, border-color 200ms ease",
        }}
      >
        {checked && (
          <svg width="13" height="10" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 3.5L3.8 6.5L9 1"
              stroke={dark ? "#0d2e1c" : "#ffffff"}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="text-base transition-colors duration-500">{label}</span>
    </label>
  );
}
