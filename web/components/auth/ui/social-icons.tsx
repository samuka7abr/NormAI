export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function GovBrWordmark({ dark = false }: { dark?: boolean }) {
  const blue = dark ? "#5d96f2" : "#1351B4";
  const yellow = "#FFCD07";
  const green = dark ? "#2ea84a" : "#168821";
  return (
    <span
      aria-hidden="true"
      className="font-extrabold lowercase leading-none tracking-tight"
      style={{ fontFamily: "var(--font-space-grotesk)" }}
    >
      <span style={{ color: blue }}>g</span>
      <span style={{ color: yellow }}>o</span>
      <span style={{ color: green }}>v</span>
      <span style={{ color: blue }}>.b</span>
      <span style={{ color: yellow }}>r</span>
    </span>
  );
}

export function MicrosoftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="1" y="1" width="7.6" height="7.6" fill="#F25022" />
      <rect x="9.4" y="1" width="7.6" height="7.6" fill="#7FBA00" />
      <rect x="1" y="9.4" width="7.6" height="7.6" fill="#00A4EF" />
      <rect x="9.4" y="9.4" width="7.6" height="7.6" fill="#FFB900" />
    </svg>
  );
}
