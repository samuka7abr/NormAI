from dataclasses import dataclass, field

OTHERS_CATEGORY = "Outros"


@dataclass
class ClassificationResult:
    """Resultado da classificação de uma coluna por IA.

    `categories` é o conjunto travado durante a descoberta e inclui sempre `OTHERS_CATEGORY`.
    `value_to_category` mapeia cada valor único da coluna para uma das categorias.
    Valores que falharam em alguma chamada vão pra `failed_values` e são considerados `OTHERS_CATEGORY`
    no mapeamento final (fallback gracioso).
    """

    categories: list[str]
    value_to_category: dict[str, str]
    failed_values: list[str] = field(default_factory=list)

    def category_for(self, value: str) -> str:
        return self.value_to_category.get(value, OTHERS_CATEGORY)
