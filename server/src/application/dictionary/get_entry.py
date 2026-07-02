from uuid import UUID

from application.dictionary.dtos import DictionaryEntryOutput
from domain.dictionary.exceptions import DictionaryEntryNotFound
from domain.dictionary.repositories import DictionaryEntryRepository


class GetDictionaryEntryUseCase:
    def __init__(self, repo: DictionaryEntryRepository) -> None:
        self._repo = repo

    async def execute(self, id: UUID, user_id: UUID) -> DictionaryEntryOutput:
        entry = await self._repo.get_by_id(id, user_id)
        if entry is None:
            raise DictionaryEntryNotFound(f"Entry {id} not found")
        return DictionaryEntryOutput(
            id=entry.id,
            user_id=entry.user_id,
            project_id=entry.project_id,
            kind=entry.kind,
            name=entry.name,
            description=entry.description,
            payload=entry.payload,
            used_in=entry.used_in,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )
