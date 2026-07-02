from collections.abc import Callable

import pytest
from pydantic import BaseModel

from application.classification.classify_column import (
    ClassifyColumnValuesUseCase,
    _distributed_sample,
)
from application.classification.dtos import ClassifyColumnInput
from application.classification.schemas import (
    CategoryRule,
    CategoryDiscoveryResponse,
    CategoryRulesResponse,
    ClassifiedItem,
    ClassifyBatchResponse,
)
from domain.classification.entities import OTHERS_CATEGORY
from domain.shared.llm_client import LLMClient, LLMError, LLMMessage


class FakeLLMClient(LLMClient):
    """Cliente fake configurável: o teste registra um handler por schema esperado."""

    def __init__(
        self,
        *,
        discovery: Callable[[list[LLMMessage]], CategoryDiscoveryResponse] | None = None,
        rules: Callable[[list[LLMMessage]], CategoryRulesResponse] | None = None,
        classify: Callable[[list[LLMMessage]], ClassifyBatchResponse] | None = None,
    ) -> None:
        self.discovery_handler = discovery
        self.rules_handler = rules
        self.classify_handler = classify
        self.discovery_calls: list[list[LLMMessage]] = []
        self.rules_calls: list[list[LLMMessage]] = []
        self.classify_calls: list[list[LLMMessage]] = []

    async def chat_structured(self, messages, schema, *, temperature: float = 0.0):
        if schema is CategoryDiscoveryResponse:
            self.discovery_calls.append(messages)
            if self.discovery_handler is None:
                raise AssertionError("discovery handler not configured")
            return self.discovery_handler(messages)
        if schema is CategoryRulesResponse:
            self.rules_calls.append(messages)
            if self.rules_handler is None:
                return CategoryRulesResponse(rules=[])
            return self.rules_handler(messages)
        if schema is ClassifyBatchResponse:
            self.classify_calls.append(messages)
            if self.classify_handler is None:
                raise AssertionError("classify handler not configured")
            return self.classify_handler(messages)
        raise AssertionError(f"unexpected schema {schema}")


def _extract_batch_values(messages: list[LLMMessage]) -> list[str]:
    user = next(m for m in messages if m.role == "user")
    return [
        line.removeprefix("- ").strip()
        for line in user.content.splitlines()
        if line.startswith("- ")
    ]


async def test_empty_values_returns_only_others():
    llm = FakeLLMClient()  # nenhum handler — não deve ser chamado
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=10, batch_size=5)

    result = await use_case.execute(
        ClassifyColumnInput(column_name="x", values=[])
    )

    assert result.categories == [OTHERS_CATEGORY]
    assert result.value_to_category == {}
    assert result.failed_values == []
    assert llm.discovery_calls == []
    assert llm.classify_calls == []


async def test_happy_path_discovers_and_classifies():
    discovered = ["Cães", "Gatos", "Aves"]

    def discovery(_messages):
        return CategoryDiscoveryResponse(categories=discovered)

    def classify(messages):
        batch = _extract_batch_values(messages)
        mapping = {"Pitbull": "Cães", "Galgo": "Cães", "Siamês": "Gatos", "Pombo": "Aves"}
        return ClassifyBatchResponse(
            items=[ClassifiedItem(value=v, category=mapping[v]) for v in batch]
        )

    llm = FakeLLMClient(discovery=discovery, classify=classify)
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=10, batch_size=2)

    result = await use_case.execute(
        ClassifyColumnInput(
            column_name="especies",
            values=["Pitbull", "Pitbull", "Galgo", "Siamês", "Pombo"],
        )
    )

    assert OTHERS_CATEGORY in result.categories
    assert "Cães" in result.categories and "Gatos" in result.categories
    assert result.value_to_category["Pitbull"] == "Cães"
    assert result.value_to_category["Galgo"] == "Cães"
    assert result.value_to_category["Siamês"] == "Gatos"
    assert result.value_to_category["Pombo"] == "Aves"
    assert result.failed_values == []
    # 4 únicos com batch_size=2 → 2 batches
    assert len(llm.classify_calls) == 2


async def test_hallucinated_category_falls_back_to_others():
    def discovery(_messages):
        return CategoryDiscoveryResponse(categories=["Aves", "Cães"])

    def classify(messages):
        batch = _extract_batch_values(messages)
        return ClassifyBatchResponse(
            items=[ClassifiedItem(value=batch[0], category="Répteis")]  # não está na lista
        )

    llm = FakeLLMClient(discovery=discovery, classify=classify)
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=10, batch_size=10)

    result = await use_case.execute(
        ClassifyColumnInput(column_name="x", values=["Iguana"])
    )

    assert result.value_to_category["Iguana"] == OTHERS_CATEGORY
    assert "Iguana" in result.failed_values


async def test_missing_value_in_response_goes_to_others():
    def discovery(_messages):
        return CategoryDiscoveryResponse(categories=["Aves"])

    def classify(messages):
        batch = _extract_batch_values(messages)
        # Devolve só o primeiro item, "esquecendo" o segundo
        return ClassifyBatchResponse(
            items=[ClassifiedItem(value=batch[0], category="Aves")]
        )

    llm = FakeLLMClient(discovery=discovery, classify=classify)
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=10, batch_size=10)

    result = await use_case.execute(
        ClassifyColumnInput(column_name="x", values=["Pombo", "Pintassilgo"])
    )

    assert result.value_to_category["Pombo"] == "Aves"
    assert result.value_to_category["Pintassilgo"] == OTHERS_CATEGORY
    assert "Pintassilgo" in result.failed_values


async def test_discovery_failure_marks_all_as_others():
    def discovery(_messages):
        raise LLMError("simulated")

    llm = FakeLLMClient(discovery=discovery)
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=10, batch_size=5)

    result = await use_case.execute(
        ClassifyColumnInput(column_name="x", values=["a", "b", "a"])
    )

    assert result.categories == [OTHERS_CATEGORY]
    assert result.value_to_category == {"a": OTHERS_CATEGORY, "b": OTHERS_CATEGORY}
    assert set(result.failed_values) == {"a", "b"}
    assert llm.classify_calls == []  # não deve sequer chamar classify


async def test_batch_failure_only_affects_that_batch():
    def discovery(_messages):
        return CategoryDiscoveryResponse(categories=["Aves"])

    call_counter = {"n": 0}

    def classify(messages):
        call_counter["n"] += 1
        if call_counter["n"] == 1:
            raise LLMError("simulated batch failure")
        batch = _extract_batch_values(messages)
        return ClassifyBatchResponse(
            items=[ClassifiedItem(value=v, category="Aves") for v in batch]
        )

    llm = FakeLLMClient(discovery=discovery, classify=classify)
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=10, batch_size=1)

    result = await use_case.execute(
        ClassifyColumnInput(column_name="x", values=["a", "b"])
    )

    # Um dos dois cai pra "Outros" (qual depende da ordem de gather, ambos são válidos)
    others_count = sum(
        1 for v in result.value_to_category.values() if v == OTHERS_CATEGORY
    )
    aves_count = sum(1 for v in result.value_to_category.values() if v == "Aves")
    assert others_count == 1
    assert aves_count == 1
    assert len(result.failed_values) == 1


async def test_generated_rules_reduce_batch_classification_without_domain_bias():
    def discovery(_messages):
        return CategoryDiscoveryResponse(categories=["Cíveis", "Criminais"])

    def rules(_messages):
        return CategoryRulesResponse(
            rules=[
                CategoryRule(category="Cíveis", keywords=["indenização", "contrato"]),
                CategoryRule(category="Criminais", keywords=["habeas corpus"]),
            ]
        )

    def classify(messages):
        batch = _extract_batch_values(messages)
        return ClassifyBatchResponse(
            items=[ClassifiedItem(value=v, category="Criminais") for v in batch]
        )

    llm = FakeLLMClient(discovery=discovery, rules=rules, classify=classify)
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=10, batch_size=10)

    result = await use_case.execute(
        ClassifyColumnInput(
            column_name="tema",
            values=["Ação de indenização", "Contrato bancário", "Prisão preventiva"],
        )
    )

    assert result.value_to_category["Ação de indenização"] == "Cíveis"
    assert result.value_to_category["Contrato bancário"] == "Cíveis"
    assert result.value_to_category["Prisão preventiva"] == "Criminais"
    assert len(llm.classify_calls) == 1
    assert _extract_batch_values(llm.classify_calls[0]) == ["Prisão preventiva"]


async def test_project_instructions_injected_in_system_prompt():
    captured: dict[str, str] = {}

    def discovery(messages):
        captured["system"] = next(m.content for m in messages if m.role == "system")
        return CategoryDiscoveryResponse(categories=["A", "B"])

    def classify(messages):
        batch = _extract_batch_values(messages)
        return ClassifyBatchResponse(
            items=[ClassifiedItem(value=v, category="A") for v in batch]
        )

    llm = FakeLLMClient(discovery=discovery, classify=classify)
    use_case = ClassifyColumnValuesUseCase(llm, sample_size=5, batch_size=5)

    await use_case.execute(
        ClassifyColumnInput(
            column_name="x",
            values=["foo"],
            project_instructions="Para tribunais, sempre prefira siglas canônicas.",
        )
    )

    assert "sempre prefira siglas canônicas" in captured["system"]


def test_distributed_sample_is_deterministic_and_spread():
    items = [f"v{i}" for i in range(100)]
    sample = _distributed_sample(items, 10)

    assert len(sample) == 10
    assert sample[0] == "v0"
    # Garantia de distribuição: o último amostrado vem da segunda metade da lista
    last_index = items.index(sample[-1])
    assert last_index >= 50
    # Determinismo: rodar de novo dá o mesmo resultado
    assert _distributed_sample(items, 10) == sample


def test_distributed_sample_returns_all_when_under_target():
    items = ["a", "b", "c"]
    assert _distributed_sample(items, 10) == items


def test_invalid_constructor_args():
    llm = FakeLLMClient()
    with pytest.raises(ValueError):
        ClassifyColumnValuesUseCase(llm, sample_size=0, batch_size=5)
    with pytest.raises(ValueError):
        ClassifyColumnValuesUseCase(llm, sample_size=5, batch_size=0)


# Smoke pra evitar regressão de import no schema strict
def test_schemas_compile():
    assert issubclass(CategoryDiscoveryResponse, BaseModel)
    assert issubclass(ClassifyBatchResponse, BaseModel)
