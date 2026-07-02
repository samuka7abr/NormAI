import logging
from inspect import isawaitable
from datetime import datetime, timezone
from uuid import UUID

from domain.reports.entities import ExecutionStatus
from domain.reports.exceptions import ReportNotFound
from domain.reports.repositories import ExecutionRepository, ReportRepository
from domain.shared.file_storage import FileStorage

from application.reports.report_processor import ReportProcessor

logger = logging.getLogger(__name__)


class ProcessReportUseCase:
    """
    Executado pelo worker para cada ReportExecution com status QUEUED.
    Ciclo: QUEUED → PROCESSING → READY | ERROR
    """

    def __init__(
        self,
        report_repo: ReportRepository,
        execution_repo: ExecutionRepository,
        storage: FileStorage,
        processor: ReportProcessor,
    ) -> None:
        self._report_repo = report_repo
        self._execution_repo = execution_repo
        self._storage = storage
        self._processor = processor

    async def execute(self, execution_id: UUID) -> None:
        execution = await self._execution_repo.get_by_id_no_report_check(execution_id)
        if execution is None:
            raise ReportNotFound(f"Execution {execution_id} not found.")

        report = await self._report_repo.get_by_id_internal(execution.report_id)
        if report is None:
            raise ReportNotFound(f"Report {execution.report_id} not found.")

        now = datetime.now(timezone.utc)
        execution.status = ExecutionStatus.PROCESSING
        execution.started_at = now
        execution.updated_at = now
        execution = await self._execution_repo.update(execution)
        await _commit_if_available(self._execution_repo)

        try:
            content = await self._collect_stream(report.original_file_key)

            result = await self._processor.process(
                content=content,
                original_filename=report.original_filename,
                column_config_snapshot=execution.column_config_snapshot,
            )

            result_key = f"{report.project_id}/{report.id}/result_{execution.id}.{self._ext(result.filename)}"
            await self._storage.save(result_key, result.content, result.content_type)

            now = datetime.now(timezone.utc)
            execution.status = ExecutionStatus.READY
            execution.progress_percent = 100
            execution.result_file_key = result_key
            execution.error_log = None
            execution.finished_at = now
            execution.updated_at = now
            execution.classification_metrics = _extract_metrics(self._processor)

        except Exception as exc:
            logger.exception("Execution %s failed: %s", execution_id, exc)
            now = datetime.now(timezone.utc)
            execution.status = ExecutionStatus.ERROR
            execution.error_log = str(exc)
            execution.finished_at = now
            execution.updated_at = now

        await self._execution_repo.update(execution)

    async def _collect_stream(self, key: str) -> bytes:
        chunks: list[bytes] = []
        stream = self._storage.load_stream(key)
        if isawaitable(stream):
            stream = await stream
        async for chunk in stream:
            chunks.append(chunk)
        return b"".join(chunks)

    @staticmethod
    def _ext(filename: str) -> str:
        return filename.rsplit(".", 1)[-1] if "." in filename else "bin"


def _extract_metrics(processor: ReportProcessor) -> dict | None:
    """Lê `last_metrics` do processor (se for o ClassificationProcessor) e converte
    pra estrutura serializável que vai persistir no execution.

    Não importa o tipo concreto aqui pra manter o use case agnóstico —
    duck-type via getattr.
    """
    metrics = getattr(processor, "last_metrics", None)
    if not metrics:
        return None
    columns: dict[str, dict] = {}
    for column, result in metrics.items():
        unique_total = len(result.value_to_category)
        failed = len(result.failed_values)
        columns[column] = {
            "categories": list(result.categories),
            "unique_values": unique_total,
            "classified_ok": unique_total - failed,
            "fell_to_others": failed,
        }
    return {"columns": columns} if columns else None


async def _commit_if_available(repository: ExecutionRepository) -> None:
    """Persist intermediate status updates when the repository owns a session.

    HTTP handlers already commit at the request boundary. The Celery worker can
    run for minutes, so PROCESSING must be visible before final READY/ERROR.
    """
    session = getattr(repository, "_session", None)
    commit = getattr(session, "commit", None)
    if commit is not None:
        await commit()
