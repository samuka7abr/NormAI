from abc import ABC, abstractmethod
from uuid import UUID

from domain.dictionary.entities import DictionaryEntry, DictionaryEntryKind, DictionaryStats


class DictionaryEntryRepository(ABC):
    @abstractmethod
    async def create(self, entry: DictionaryEntry) -> DictionaryEntry: ...

    @abstractmethod
    async def get_by_id(self, id: UUID, user_id: UUID) -> DictionaryEntry | None: ...

    @abstractmethod
    async def list_global(
        self,
        user_id: UUID,
        kind: DictionaryEntryKind | None,
        offset: int,
        limit: int,
        q: str | None = None,
    ) -> tuple[list[DictionaryEntry], int]: ...

    @abstractmethod
    async def list_by_project(
        self,
        project_id: UUID,
        user_id: UUID,
        kind: DictionaryEntryKind | None,
        offset: int,
        limit: int,
        q: str | None = None,
    ) -> tuple[list[DictionaryEntry], int]: ...

    @abstractmethod
    async def list_merged(
        self,
        user_id: UUID,
        project_id: UUID,
        kind: DictionaryEntryKind | None,
    ) -> list[DictionaryEntry]: ...

    @abstractmethod
    async def update(self, entry: DictionaryEntry) -> DictionaryEntry: ...

    @abstractmethod
    async def delete(self, id: UUID, user_id: UUID) -> None: ...

    @abstractmethod
    async def get_stats(self, user_id: UUID) -> DictionaryStats: ...
