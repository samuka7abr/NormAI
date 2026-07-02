from dataclasses import dataclass
from math import ceil
from uuid import UUID

from domain.dictionary.entities import DictionaryEntryKind


@dataclass
class CreateDictionaryEntryInput:
    user_id: UUID
    project_id: UUID | None
    kind: DictionaryEntryKind
    name: str
    description: str
    payload: dict


@dataclass
class UpdateDictionaryEntryInput:
    id: UUID
    user_id: UUID
    name: str | None
    description: str | None
    payload: dict | None


@dataclass
class ListDictionaryEntriesInput:
    user_id: UUID
    project_id: UUID | None  # None = list global; set = list project-scoped
    kind: DictionaryEntryKind | None
    page: int
    page_size: int
    q: str | None = None


@dataclass
class DictionaryEntryOutput:
    id: UUID
    user_id: UUID
    project_id: UUID | None
    kind: DictionaryEntryKind
    name: str
    description: str
    payload: dict
    used_in: list[UUID]
    created_at: object
    updated_at: object


@dataclass
class PaginatedDictionaryEntriesOutput:
    items: list[DictionaryEntryOutput]
    total: int
    page: int
    page_size: int
    total_pages: int

    @staticmethod
    def build(
        items: list,
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedDictionaryEntriesOutput":
        return PaginatedDictionaryEntriesOutput(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=ceil(total / page_size) if total > 0 else 1,
        )
