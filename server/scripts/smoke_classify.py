"""Smoke test do ClassifyColumnValuesUseCase contra o LLM configurado.

Uso:
  docker compose exec api uv run python scripts/smoke_classify.py

Lê LLM_* das settings (Ollama em dev). Imprime as categorias descobertas
e o mapeamento valor → categoria.
"""
import asyncio
import json
import sys
import time

from application.classification.classify_column import ClassifyColumnValuesUseCase
from application.classification.dtos import ClassifyColumnInput
from infrastructure.llm.openai_compatible_client import OpenAICompatibleClient
from infrastructure.settings import get_settings


SAMPLES: dict[str, list[str]] = {
    "especies_afetadas": [
        "Pitbull", "Galgo Inglês", "Pastor Alemão", "Vira-lata",
        "Siamês", "Persa", "Gato comum",
        "Pombo", "Papagaio", "Pintassilgo de cabeça preta", "Bem-te-vi",
        "Cavalo", "Égua", "Pônei",
        "Boi", "Vaca", "Bezerro",
        "Onça-pintada", "Tatu-bola", "Capivara",
        "NA", "Não informado",
    ],
    "tipos_violencia": [
        "Inanição/Fome", "Falta de água", "Desnutrição grave",
        "Espancamento", "Agressão com objeto contundente", "Tortura",
        "Abandono em via pública", "Confinamento prolongado",
        "Envenenamento", "Tiro com arma de fogo",
        "Rinha", "Briga organizada",
    ],
}


async def _run_column(use_case: ClassifyColumnValuesUseCase, column: str, values: list[str]) -> None:
    print(f"\n=== {column} ({len(values)} valores, {len(set(values))} únicos) ===")
    started = time.perf_counter()
    result = await use_case.execute(
        ClassifyColumnInput(
            column_name=column,
            values=values,
            project_instructions=(
                "Contexto: planilha de relatórios de maus tratos a animais. "
                "Prefira categorias amplas que agrupem espécies por classe biológica."
                if column == "especies_afetadas"
                else "Contexto: tipologia de violência em casos de maus tratos."
            ),
        )
    )
    elapsed = time.perf_counter() - started
    print(f"tempo: {elapsed:.1f}s")
    print(f"categorias travadas: {result.categories}")
    print("mapeamento:")
    for value, category in result.value_to_category.items():
        marker = " ⚠️" if value in result.failed_values else ""
        print(f"  {value!r:<45} → {category}{marker}")
    if result.failed_values:
        print(f"\nfalhas (caíram em Outros): {len(result.failed_values)}")


async def main() -> int:
    settings = get_settings()
    print(f"LLM_BASE_URL={settings.llm_base_url}")
    print(f"LLM_MODEL={settings.llm_model}")
    print(f"sample_size={settings.llm_sample_size}, batch_size={settings.llm_batch_size}")

    llm = OpenAICompatibleClient(settings)
    use_case = ClassifyColumnValuesUseCase(
        llm,
        sample_size=settings.llm_sample_size,
        batch_size=settings.llm_batch_size,
    )

    for column, values in SAMPLES.items():
        try:
            await _run_column(use_case, column, values)
        except Exception as exc:  # noqa: BLE001 - script de diagnóstico
            print(f"!! falha total em {column}: {exc!r}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
