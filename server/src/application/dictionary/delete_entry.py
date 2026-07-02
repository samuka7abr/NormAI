from uuid import UUID

from domain.dictionary.exceptions import DictionaryEntryNotFound
from domain.dictionary.repositories import DictionaryEntryRepository


class DeleteDictionaryEntryUseCase:
    def __init__(self, repo: DictionaryEntryRepository) -> None:
        self._repo = repo

    async def execute(self, id: UUID, user_id: UUID) -> None:
        entry = await self._repo.get_by_id(id, user_id)
        if entry is None:
            raise DictionaryEntryNotFound(f"Entry {id} not found")
        await self._repo.delete(id, user_id)
