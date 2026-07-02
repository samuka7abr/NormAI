import logging
from uuid import UUID

from domain.shared.processing_queue import ProcessingQueue

logger = logging.getLogger(__name__)


class NoopProcessingQueue(ProcessingQueue):
    """Stub sem fila real — substitua pela integração Celery+Redis quando disponível."""

    async def enqueue_execution(self, execution_id: UUID) -> None:
        logger.info("NoopProcessingQueue: execution %s enqueued (noop)", execution_id)
