from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class FileStorage(ABC):
    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Salva bytes no storage e retorna a key."""

    @abstractmethod
    async def load_stream(self, key: str) -> AsyncIterator[bytes]:
        """Retorna um stream assíncrono de bytes para a key."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Remove o objeto do storage."""

    @abstractmethod
    async def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Gera URL pré-assinada para download direto."""
