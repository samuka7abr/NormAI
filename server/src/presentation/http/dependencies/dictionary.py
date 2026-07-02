from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from application.dictionary.create_entry import CreateDictionaryEntryUseCase
from application.dictionary.delete_entry import DeleteDictionaryEntryUseCase
from application.dictionary.get_entry import GetDictionaryEntryUseCase
from application.dictionary.get_stats import GetDictionaryStatsUseCase
from application.dictionary.list_entries import ListDictionaryEntriesUseCase
from application.dictionary.update_entry import UpdateDictionaryEntryUseCase
from infrastructure.persistence.database import get_db
from infrastructure.persistence.repositories.dictionary_repository import SqlAlchemyDictionaryEntryRepository


def _repo(db: AsyncSession = Depends(get_db)) -> SqlAlchemyDictionaryEntryRepository:
    return SqlAlchemyDictionaryEntryRepository(db)


def get_create_entry_use_case(repo: SqlAlchemyDictionaryEntryRepository = Depends(_repo)) -> CreateDictionaryEntryUseCase:
    return CreateDictionaryEntryUseCase(repo)


def get_get_entry_use_case(repo: SqlAlchemyDictionaryEntryRepository = Depends(_repo)) -> GetDictionaryEntryUseCase:
    return GetDictionaryEntryUseCase(repo)


def get_list_entries_use_case(repo: SqlAlchemyDictionaryEntryRepository = Depends(_repo)) -> ListDictionaryEntriesUseCase:
    return ListDictionaryEntriesUseCase(repo)


def get_update_entry_use_case(repo: SqlAlchemyDictionaryEntryRepository = Depends(_repo)) -> UpdateDictionaryEntryUseCase:
    return UpdateDictionaryEntryUseCase(repo)


def get_delete_entry_use_case(repo: SqlAlchemyDictionaryEntryRepository = Depends(_repo)) -> DeleteDictionaryEntryUseCase:
    return DeleteDictionaryEntryUseCase(repo)


def get_stats_use_case(repo: SqlAlchemyDictionaryEntryRepository = Depends(_repo)) -> GetDictionaryStatsUseCase:
    return GetDictionaryStatsUseCase(repo)
