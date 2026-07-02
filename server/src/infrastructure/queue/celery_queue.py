"""Implementação de ProcessingQueue que publica jobs no Celery."""
import logging
from uuid import UUID

from domain.shared.processing_queue import ProcessingQueue
from infrastructure.worker.tasks import process_report_task

logger = logging.getLogger(__name__)


class CeleryProcessingQueue(ProcessingQueue):
    async def enqueue_execution(self, execution_id: UUID) -> None:
        # `.delay()` é síncrono e leve (apenas publica no broker); seguro de chamar
        # do contexto async do FastAPI sem `to_thread`.
        process_report_task.delay(str(execution_id))
        logger.info("CeleryProcessingQueue: execution %s enqueued", execution_id)
