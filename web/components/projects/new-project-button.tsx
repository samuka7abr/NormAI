import Link from "next/link";
import { Plus } from "lucide-react";

export function NewProjectButton() {
  return (
    <Link href="/projects/new" className="btn-cta" aria-label="Criar novo projeto">
      <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
      Novo Projeto
    </Link>
  );
}
