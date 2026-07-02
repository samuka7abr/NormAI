"""Celery task que consome `execution_id` e roda o `ProcessReportUseCase`.

A task é registrada no Celery por `include=["infrastructure.worker.tasks"]`
em `celery_app.py`. Em retry-loop só persistente: até `celery_worker_max_retries`
e depois propaga (a execução é marcada como ERROR pelo próprio use case).
"""
import asyncio
import logging
from uuid import UUID

from application.reports.process_report import ProcessReportUseCase
from infrastructure.persistence.database import AsyncSessionLocal
from infrastructure.persistence.repositories.execution_repository import (
    SqlAlchemyExecutionRepository,
)
from infrastructure.persistence.repositories.report_repository import (
    SqlAlchemyReportRepository,
)
from infrastructure.processor.factory import build_report_processor
from infrastructure.settings import get_settings
from infrastructure.storage.s3_file_storage import S3FileStorage
from infrastructure.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run(execution_id: UUID) -> None:
    settings = get_settings()
    session = AsyncSessionLocal()
    try:
        use_case = ProcessReportUseCase(
            report_repo=SqlAlchemyReportRepository(session),
            execution_repo=SqlAlchemyExecutionRepository(session),
            storage=S3FileStorage(settings),
            processor=build_report_processor(settings),
        )
        await use_case.execute(execution_id)
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


@celery_app.task(name="process_report", bind=True, acks_late=True)
def process_report_task(self, execution_id: str) -> None:  # noqa: ANN001 - bound task
    """Recebe `execution_id` como string (JSON-serializável)."""
    settings = get_settings()
    try:
        asyncio.run(_run(UUID(execution_id)))
    except Exception as exc:
        logger.exception("process_report_task failed for execution=%s", execution_id)
        # Retry só se ainda houver tentativas. Depois, o ProcessReportUseCase
        # já terá marcado a execução como ERROR no banco.
        if self.request.retries < settings.celery_worker_max_retries:
            raise self.retry(
                exc=exc,
                countdown=settings.celery_worker_retry_countdown_s,
            ) from exc
        raise
