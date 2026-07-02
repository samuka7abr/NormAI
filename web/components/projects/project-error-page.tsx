import Link from "next/link";

interface ProjectErrorPageProps {
  error: Error;
}

export function ProjectErrorPage({ error }: ProjectErrorPageProps) {
  return (
    <div
      style={{
        flex: 1,
        padding: "60px 100px",
        maxWidth: "800px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "24px",
      }}
    >
      <div>
        <h1 style={{ margin: "0 0 16px 0", color: "#ef4444", fontFamily: "var(--font-space-grotesk)" }}>
          Erro ao carregar projeto
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          {error.message || "Ocorreu um erro desconhecido."}
        </p>
      </div>
      <div style={{ display: "flex", gap: "12px" }}>
        <Link
          href="/projects"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "#1f2937",
            color: "#fff",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Voltar para Projetos
        </Link>
      </div>
    </div>
  );
}
