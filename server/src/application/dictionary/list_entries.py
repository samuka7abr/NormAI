from application.dictionary.dtos import (
    DictionaryEntryOutput,
    ListDictionaryEntriesInput,
    PaginatedDictionaryEntriesOutput,
)
from domain.dictionary.repositories import DictionaryEntryRepository


class ListDictionaryEntriesUseCase:
    def __init__(self, repo: DictionaryEntryRepository) -> None:
        self._repo = repo

    async def execute(self, input: ListDictionaryEntriesInput) -> PaginatedDictionaryEntriesOutput:
        page_size = min(input.page_size, 100)
        offset = (input.page - 1) * page_size

        if input.project_id is None:
            entries, total = await self._repo.list_global(
                user_id=input.user_id,
                kind=input.kind,
                offset=offset,
                limit=page_size,
                q=input.q,
            )
        else:
            entries, total = await self._repo.list_by_project(
                project_id=input.project_id,
                user_id=input.user_id,
                kind=input.kind,
                offset=offset,
                limit=page_size,
                q=input.q,
            )

        items = [
            DictionaryEntryOutput(
                id=e.id,
                user_id=e.user_id,
                project_id=e.project_id,
                kind=e.kind,
                name=e.name,
                description=e.description,
                payload=e.payload,
                used_in=e.used_in,
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
            for e in entries
        ]
        return PaginatedDictionaryEntriesOutput.build(items, total, input.page, page_size)
