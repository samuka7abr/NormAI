import asyncio
import logging
import re
import unicodedata

from application.classification.dtos import ClassifyColumnInput
from application.classification.prompts import (
    build_classify_messages,
    build_discovery_messages,
    build_rule_messages,
)
from application.classification.schemas import (
    CategoryRule,
    CategoryDiscoveryResponse,
    CategoryRulesResponse,
    ClassifyBatchResponse,
)
from domain.classification.entities import OTHERS_CATEGORY, ClassificationResult
from domain.shared.llm_client import LLMClient, LLMError, LLMMessage

logger = logging.getLogger(__name__)

MIN_CATEGORIES = 2
MAX_CATEGORIES = 20


class ClassifyColumnValuesUseCase:
    """Classifica os valores de uma coluna em categorias inferidas pela IA.

    Fluxo:
    1. Dedup dos valores recebidos preservando ordem de aparição.
    2. Amostragem distribuída determinística dos únicos (até `sample_size`).
    3. Uma chamada de descoberta → conjunto travado de categorias (sempre inclui "Outros").
    4. Classificação dos demais únicos em batches paralelos.
    5. Mapeamento valor único → categoria. Falhas viram "Outros" em `failed_values`.
    """

    def __init__(
        self,
        llm: LLMClient,
        *,
        sample_size: int,
        batch_size: int,
    ) -> None:
        if sample_size <= 0:
            raise ValueError("sample_size must be > 0")
        if batch_size <= 0:
            raise ValueError("batch_size must be > 0")
        self._llm = llm
        self._sample_size = sample_size
        self._batch_size = batch_size

    async def execute(self, payload: ClassifyColumnInput) -> ClassificationResult:
        unique_values = _dedup_preserving_order(payload.values)
        if not unique_values:
            return ClassificationResult(
                categories=[OTHERS_CATEGORY],
                value_to_category={},
                failed_values=[],
            )

        sample = _distributed_sample(unique_values, self._sample_size)
        try:
            categories = await self._discover_categories(
                column_name=payload.column_name,
                sample=sample,
                project_instructions=payload.project_instructions,
            )
        except LLMError as exc:
            logger.warning(
                "category discovery failed for column %s: %s — falling back to '%s' only",
                payload.column_name,
                exc,
                OTHERS_CATEGORY,
            )
            return ClassificationResult(
                categories=[OTHERS_CATEGORY],
                value_to_category={value: OTHERS_CATEGORY for value in unique_values},
                failed_values=list(unique_values),
            )

        categories = _normalize_categories(categories)
        rules = await self._discover_rules(
            column_name=payload.column_name,
            categories=categories,
            sample=sample,
            project_instructions=payload.project_instructions,
        )
        value_to_category, failed = await self._classify_all(
            column_name=payload.column_name,
            unique_values=unique_values,
            categories=categories,
            rules=rules,
            project_instructions=payload.project_instructions,
        )
        return ClassificationResult(
            categories=categories,
            value_to_category=value_to_category,
            failed_values=failed,
        )

    async def _discover_categories(
        self,
        *,
        column_name: str,
        sample: list[str],
        project_instructions: str | None,
    ) -> list[str]:
        system, user = build_discovery_messages(column_name, sample, project_instructions)
        response = await self._llm.chat_structured(
            messages=[LLMMessage("system", system), LLMMessage("user", user)],
            schema=CategoryDiscoveryResponse,
            temperature=0.0,
        )
        return response.categories

    async def _discover_rules(
        self,
        *,
        column_name: str,
        categories: list[str],
        sample: list[str],
        project_instructions: str | None,
    ) -> list[CategoryRule]:
        system, user = build_rule_messages(
            column_name, categories, sample, project_instructions
        )
        try:
            response = await self._llm.chat_structured(
                messages=[LLMMessage("system", system), LLMMessage("user", user)],
                schema=CategoryRulesResponse,
                temperature=0.0,
            )
        except LLMError as exc:
            logger.warning(
                "category rule discovery failed for column %s: %s — continuing with batch classification",
                column_name,
                exc,
            )
            return []
        allowed = set(categories)
        return [
            rule
            for rule in response.rules
            if rule.category in allowed and rule.category != OTHERS_CATEGORY
        ]

    async def _classify_all(
        self,
        *,
        column_name: str,
        unique_values: list[str],
        categories: list[str],
        rules: list[CategoryRule],
        project_instructions: str | None,
    ) -> tuple[dict[str, str], list[str]]:
        value_to_category, remaining = _classify_by_rules(unique_values, rules)
        logger.info(
            "category rules classified %d/%d values for column %s; residual=%d",
            len(value_to_category),
            len(unique_values),
            column_name,
            len(remaining),
        )
        batches = [
            remaining[i : i + self._batch_size]
            for i in range(0, len(remaining), self._batch_size)
        ]
        results = await asyncio.gather(
            *(
                self._classify_batch(
                    column_name=column_name,
                    batch=batch,
                    categories=categories,
                    project_instructions=project_instructions,
                )
                for batch in batches
            ),
            return_exceptions=False,
        )

        failed: list[str] = []
        for batch, (mapping, batch_failed) in zip(batches, results, strict=True):
            value_to_category.update(mapping)
            failed.extend(batch_failed)
            # qualquer valor do batch que sumiu da resposta cai pra "Outros".
            for value in batch:
                if value not in mapping:
                    value_to_category[value] = OTHERS_CATEGORY
                    failed.append(value)
        return value_to_category, failed

    async def _classify_batch(
        self,
        *,
        column_name: str,
        batch: list[str],
        categories: list[str],
        project_instructions: str | None,
    ) -> tuple[dict[str, str], list[str]]:
        system, user = build_classify_messages(
            column_name, categories, batch, project_instructions
        )
        try:
            response = await self._llm.chat_structured(
                messages=[LLMMessage("system", system), LLMMessage("user", user)],
                schema=ClassifyBatchResponse,
                temperature=0.0,
            )
        except LLMError as exc:
            logger.warning(
                "classify batch failed for column %s (size=%d): %s — marking as '%s'",
                column_name,
                len(batch),
                exc,
                OTHERS_CATEGORY,
            )
            return {value: OTHERS_CATEGORY for value in batch}, list(batch)

        allowed = set(categories)
        batch_set = set(batch)
        mapping: dict[str, str] = {}
        failed: list[str] = []
        for item in response.items:
            if item.value not in batch_set:
                continue  # alucinação: valor que não estava no batch
            category = item.category if item.category in allowed else OTHERS_CATEGORY
            if category == OTHERS_CATEGORY and item.category != OTHERS_CATEGORY:
                failed.append(item.value)
            mapping[item.value] = category
        return mapping, failed


def _dedup_preserving_order(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def _classify_by_rules(
    values: list[str], rules: list[CategoryRule]
) -> tuple[dict[str, str], list[str]]:
    if not rules:
        return {}, list(values)

    prepared_rules = [
        (
            rule.category,
            [
                normalized
                for keyword in rule.keywords
                if (normalized := _normalize_text(keyword))
            ],
        )
        for rule in rules
    ]
    prepared_rules = [(category, keywords) for category, keywords in prepared_rules if keywords]

    classified: dict[str, str] = {}
    remaining: list[str] = []
    for value in values:
        normalized_value = _normalize_text(value)
        matches = {
            category
            for category, keywords in prepared_rules
            if any(_keyword_matches(normalized_value, keyword) for keyword in keywords)
        }
        if len(matches) == 1:
            classified[value] = next(iter(matches))
        else:
            remaining.append(value)
    return classified, remaining


def _keyword_matches(value: str, keyword: str) -> bool:
    if not keyword:
        return False
    if len(keyword) <= 2:
        return keyword in set(_tokens(value))
    if " " in keyword:
        return keyword in value
    return keyword in set(_tokens(value)) or keyword in value.split("|")


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text)


def _normalize_text(text: str) -> str:
    without_accents = "".join(
        char
        for char in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"\s+", " ", without_accents).strip()


def _distributed_sample(items: list[str], target_size: int) -> list[str]:
    """Amostra determinística distribuída uniformemente sobre `items`.

    Não usa aleatoriedade pra garantir testes reprodutíveis. A distribuição
    quebra a correlação posicional sem precisar de seed.
    """
    if len(items) <= target_size:
        return list(items)
    stride = len(items) / target_size
    indices = {int(i * stride) for i in range(target_size)}
    return [items[i] for i in sorted(indices)]


def _normalize_categories(categories: list[str]) -> list[str]:
    """Garante invariantes do conjunto de categorias antes de travar.

    - Remove duplicatas case-insensitive preservando a primeira ocorrência.
    - Garante que OTHERS_CATEGORY está presente (no final).
    - Recorta pra MAX_CATEGORIES se o LLM exagerou.
    - Falha se o LLM retornou categorias de menos.
    """
    seen: set[str] = set()
    cleaned: list[str] = []
    for raw in categories:
        name = (raw or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        if name == OTHERS_CATEGORY:
            continue  # adicionamos no final
        seen.add(key)
        cleaned.append(name)

    if len(cleaned) > MAX_CATEGORIES - 1:
        cleaned = cleaned[: MAX_CATEGORIES - 1]
    if len(cleaned) < MIN_CATEGORIES - 1:
        # LLM produziu lista vazia/quase vazia. Não é fatal — degradar pra só "Outros"
        # é responsabilidade do caller; aqui só sinalizamos com o conjunto mínimo.
        logger.warning("discovery returned too few categories: %s", cleaned)
    cleaned.append(OTHERS_CATEGORY)
    return cleaned
