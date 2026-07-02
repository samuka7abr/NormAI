from uuid import UUID

from domain.dictionary.entities import DictionaryStats
from domain.dictionary.repositories import DictionaryEntryRepository


class GetDictionaryStatsUseCase:
    def __init__(self, repo: DictionaryEntryRepository) -> None:
        self._repo = repo

    async def execute(self, user_id: UUID) -> DictionaryStats:
        return await self._repo.get_stats(user_id)
