"""Processor que combina normalização determinística + classificação por IA.

Composição:
1. Delega ao `NormalizationProcessor` existente pra produzir o CSV/XLSX normalizado.
2. Reparseia o resultado normalizado pra estrutura tabular.
3. Pra cada coluna marcada com `classify=true` no snapshot, coleta valores únicos
   (ignorando vazios), chama `ClassifyColumnValuesUseCase`, e adiciona uma coluna
   `<original>_categoria` no output final.

Se o snapshot tiver `_project.ai_context`, ele é injetado como instruções nas
chamadas ao LLM (HU-08 — dicionário/contexto por projeto, texto livre).

O resultado da classificação por coluna é exposto via `last_metrics` pra o caller
persistir nas métricas da execução (seção 7 do PRD).
"""
import logging

from application.classification.classify_column import ClassifyColumnValuesUseCase
from application.classification.dtos import ClassifyColumnInput
from application.reports.report_processor import ProcessingResult, ReportProcessor
from domain.classification.entities import ClassificationResult
from infrastructure.processor.normalization_processor import NormalizationProcessor
from infrastructure.processor.table_io import (
    CATEGORY_SUFFIX,
    Table,
    parse_table,
    serialize_table,
)

logger = logging.getLogger(__name__)


class ClassificationProcessor(ReportProcessor):
    def __init__(
        self,
        normalization_processor: NormalizationProcessor,
        classify_use_case: ClassifyColumnValuesUseCase,
    ) -> None:
        self._normalize = normalization_processor
        self._classify = classify_use_case
        self.last_metrics: dict[str, ClassificationResult] = {}

    async def process(
        self,
        content: bytes,
        original_filename: str,
        column_config_snapshot: dict,
    ) -> ProcessingResult:
        normalized = await self._normalize.process(
            content=content,
            original_filename=original_filename,
            column_config_snapshot=column_config_snapshot,
        )

        classify_targets = _classify_targets(column_config_snapshot)
        if not classify_targets:
            self.last_metrics = {}
            return normalized

        table = parse_table(normalized.content, normalized.filename)
        project_instructions = _project_instructions(column_config_snapshot)

        metrics: dict[str, ClassificationResult] = {}
        for column in classify_targets:
            if column not in table.headers:
                logger.warning(
                    "skipping classification for missing column %r (headers=%s)",
                    column,
                    table.headers,
                )
                continue
            values = [row.get(column, "") for row in table.rows]
            non_empty = [v for v in values if v]
            if not non_empty:
                continue

            result = await self._classify.execute(
                ClassifyColumnInput(
                    column_name=column,
                    values=non_empty,
                    project_instructions=project_instructions,
                )
            )
            metrics[column] = result
            _add_category_column(table, column, result)

        self.last_metrics = metrics
        rebuilt, out_filename, content_type = serialize_table(table, original_filename)
        return ProcessingResult(
            content=rebuilt,
            filename=out_filename,
            content_type=content_type,
        )


def _classify_targets(snapshot: dict) -> list[str]:
    targets: list[str] = []
    for key, cfg in snapshot.items():
        if key.startswith("_") or not isinstance(cfg, dict):
            continue
        if not cfg.get("enabled", True):
            continue
        if cfg.get("classify"):
            targets.append(key)
    return targets


def _project_instructions(snapshot: dict) -> str | None:
    project_meta = snapshot.get("_project")
    if isinstance(project_meta, dict):
        text = project_meta.get("ai_context")
        if isinstance(text, str) and text.strip():
            return text.strip()
    return None


def _add_category_column(table: Table, column: str, result: ClassificationResult) -> None:
    new_header = f"{column}{CATEGORY_SUFFIX}"
    if new_header not in table.headers:
        table.headers.append(new_header)
    for row in table.rows:
        value = row.get(column, "")
        row[new_header] = result.category_for(value) if value else ""
