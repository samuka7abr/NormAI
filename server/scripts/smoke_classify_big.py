"""Smoke test com amostra grande do ClassifyColumnValuesUseCase.

Uso:
  docker compose exec -e LLM_BATCH_SIZE=10 -e LLM_TIMEOUT_S=300 \\
      -e LLM_SAMPLE_SIZE=40 -T api uv run python /app/scripts/smoke_classify_big.py

Amostra de ~95 valores únicos cobrindo várias classes biológicas. Mede:
- tempo de discovery (com amostra distribuída de tamanho LLM_SAMPLE_SIZE)
- tempo total da fase de classify em batches paralelos
- contagem de acertos por categoria
- número de fallbacks pra "Outros" e falhas explícitas
"""
import asyncio
import time
from collections import Counter

from application.classification.classify_column import ClassifyColumnValuesUseCase
from application.classification.dtos import ClassifyColumnInput
from domain.classification.entities import OTHERS_CATEGORY
from infrastructure.llm.openai_compatible_client import OpenAICompatibleClient
from infrastructure.settings import get_settings


# Mapeamento esperado (gabarito) — usado pra calcular acerto perceptivo.
# É uma simplificação biológica; o LLM pode escolher nomes de categoria
# parecidos ("Mamíferos" vs "Mamíferos Domésticos"); na hora de comparar
# normalizamos por substring.
EXPECTED: dict[str, str] = {
    # Cães
    **{v: "Mamíferos" for v in [
        "Pitbull", "Labrador", "Golden Retriever", "Pastor Alemão", "Pastor Belga",
        "Vira-lata caramelo", "Bulldog Francês", "Rottweiler", "Husky Siberiano",
        "Border Collie", "Dachshund", "Yorkshire", "Maltês", "Pinscher", "Beagle",
    ]},
    # Gatos
    **{v: "Mamíferos" for v in [
        "Siamês", "Persa", "Maine Coon", "Sphynx", "Angorá", "Gato comum",
        "Bengal", "Ragdoll", "Birmanês",
    ]},
    # Equinos
    **{v: "Mamíferos" for v in [
        "Cavalo", "Égua", "Pônei", "Mangalarga", "Quarto de Milha",
    ]},
    # Bovinos / animais de fazenda
    **{v: "Mamíferos" for v in [
        "Boi", "Vaca", "Bezerro", "Búfalo", "Bovino Nelore",
        "Cabra", "Bode", "Ovelha", "Carneiro", "Porco",
    ]},
    # Mamíferos selvagens
    **{v: "Mamíferos" for v in [
        "Onça-pintada", "Onça-parda", "Jaguatirica", "Tatu-bola", "Capivara",
        "Lobo-guará", "Tamanduá-bandeira", "Preguiça", "Macaco-prego", "Bugio",
    ]},
    # Aves
    **{v: "Aves" for v in [
        "Pombo", "Papagaio", "Pintassilgo de cabeça preta", "Bem-te-vi",
        "Tucano", "Arara", "Curió", "Sabiá-laranjeira", "Coruja-buraqueira",
        "Gavião-real", "Urubu", "Galinha caipira", "Pato", "Galo de briga",
    ]},
    # Répteis
    **{v: "Répteis" for v in [
        "Jiboia", "Sucuri", "Cascavel", "Jararaca", "Iguana", "Jacaré-do-papo-amarelo",
        "Cágado", "Tartaruga marinha",
    ]},
    # Peixes
    **{v: "Peixes" for v in [
        "Pacu", "Tambaqui", "Tilápia", "Tucunaré", "Dourado", "Pirarucu",
        "Lambari", "Bagre",
    ]},
    # Anfíbios
    **{v: "Anfíbios" for v in [
        "Perereca", "Rã-touro", "Sapo-cururu",
    ]},
    # Casos especiais / nulos
    **{v: OTHERS_CATEGORY for v in [
        "NA", "Não informado", "Sem informação", "N/A", "-",
    ]},
}


def _score(result_mapping: dict[str, str]) -> tuple[int, int, list[tuple[str, str, str]]]:
    """Conta acertos vs gabarito, considerando contém-substring pro nome da categoria."""
    correct = 0
    errors: list[tuple[str, str, str]] = []
    for value, expected in EXPECTED.items():
        actual = result_mapping.get(value, "<missing>")
        if expected == OTHERS_CATEGORY:
            ok = actual == OTHERS_CATEGORY
        else:
            ok = expected.lower() in actual.lower() or actual.lower() in expected.lower()
        if ok:
            correct += 1
        else:
            errors.append((value, expected, actual))
    return correct, len(EXPECTED), errors


async def main() -> int:
    settings = get_settings()
    print("=" * 60)
    print(f"LLM_BASE_URL={settings.llm_base_url}")
    print(f"LLM_MODEL={settings.llm_model}")
    print(
        f"sample_size={settings.llm_sample_size}  batch_size={settings.llm_batch_size}  "
        f"timeout={settings.llm_timeout_s}s  concurrency={settings.llm_max_concurrency}"
    )
    print("=" * 60)

    values = list(EXPECTED.keys())
    print(f"\namostra: {len(values)} valores únicos")

    llm = OpenAICompatibleClient(settings)
    use_case = ClassifyColumnValuesUseCase(
        llm,
        sample_size=settings.llm_sample_size,
        batch_size=settings.llm_batch_size,
    )

    started = time.perf_counter()
    result = await use_case.execute(
        ClassifyColumnInput(
            column_name="especies_afetadas",
            values=values,
            project_instructions=(
                "Contexto: planilha de relatórios judiciais de maus tratos a animais. "
                "Use categorias amplas que agrupem espécies por classe biológica "
                "(ex.: Mamíferos, Aves, Répteis, Peixes, Anfíbios). Não crie categorias "
                "por raça ou tamanho."
            ),
        )
    )
    elapsed = time.perf_counter() - started

    print(f"\n[tempo total] {elapsed:.1f}s")
    print(f"[categorias travadas] {result.categories}")

    by_category = Counter(result.value_to_category.values())
    print("\n[distribuição]")
    for cat, count in by_category.most_common():
        print(f"  {cat:<30} {count}")

    correct, total, errors = _score(result.value_to_category)
    pct = 100 * correct / total if total else 0
    print(f"\n[acerto perceptivo] {correct}/{total} ({pct:.1f}%)")
    if errors:
        print("\n[divergências vs gabarito]")
        for value, expected, actual in errors[:30]:
            print(f"  {value!r:<45} esperado={expected!r:<12} obteve={actual!r}")
        if len(errors) > 30:
            print(f"  ... e mais {len(errors) - 30}")

    if result.failed_values:
        print(f"\n[falhas explícitas em chamadas] {len(result.failed_values)}")
        for v in result.failed_values[:10]:
            print(f"  - {v}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
