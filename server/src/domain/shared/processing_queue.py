from abc import ABC, abstractmethod
from uuid import UUID


class ProcessingQueue(ABC):
    """Interface para fila de processamento. Implementação com Celery + Redis a cargo de outro colega."""

    @abstractmethod
    async def enqueue_execution(self, execution_id: UUID) -> None:
        """Publica job de processamento na fila."""
