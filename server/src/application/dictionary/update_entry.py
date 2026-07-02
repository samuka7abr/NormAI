from datetime import datetime, timezone

from application.dictionary.dtos import DictionaryEntryOutput, UpdateDictionaryEntryInput
from domain.dictionary.exceptions import DictionaryEntryNotFound
from domain.dictionary.repositories import DictionaryEntryRepository


class UpdateDictionaryEntryUseCase:
    def __init__(self, repo: DictionaryEntryRepository) -> None:
        self._repo = repo

    async def execute(self, input: UpdateDictionaryEntryInput) -> DictionaryEntryOutput:
        entry = await self._repo.get_by_id(input.id, input.user_id)
        if entry is None:
            raise DictionaryEntryNotFound(f"Entry {input.id} not found")

        if input.name is not None:
            entry.name = input.name.strip()
        if input.description is not None:
            entry.description = input.description
        if input.payload is not None:
            entry.payload = input.payload
        entry.updated_at = datetime.now(timezone.utc)

        updated = await self._repo.update(entry)
        return DictionaryEntryOutput(
            id=updated.id,
            user_id=updated.user_id,
            project_id=updated.project_id,
            kind=updated.kind,
            name=updated.name,
            description=updated.description,
            payload=updated.payload,
            used_in=updated.used_in,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        )
