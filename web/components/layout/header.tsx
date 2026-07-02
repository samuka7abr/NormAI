import { DashboardThemeToggle } from "./dashboard-theme-toggle";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header
      className="nav-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <h1
        className="nav-title"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 700,
          fontSize: "18px",
          letterSpacing: "-0.025em",
          margin: 0,
        }}
      >
        {title}
      </h1>

      <DashboardThemeToggle />
    </header>
  );
}
