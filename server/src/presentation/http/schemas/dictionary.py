from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from domain.dictionary.entities import DictionaryEntryKind


class CreateDictionaryEntryRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    kind: DictionaryEntryKind
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    items: list[str] | None = None
    content: str | None = None
    pairs: list[list[str]] | None = None


class UpdateDictionaryEntryRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    items: list[str] | None = None
    content: str | None = None
    pairs: list[list[str]] | None = None


class DictionaryEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: DictionaryEntryKind
    title: str
    description: str
    used_in: list[UUID]
    updated_at: datetime
    items: list[str] | None
    content: str | None
    pairs: list[list[str]] | None


class PaginatedDictionaryEntriesResponse(BaseModel):
    items: list[DictionaryEntryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DictionaryMostUsedResponse(BaseModel):
    id: UUID
    title: str
    type: str
    used_count: int


class DictionaryStatsResponse(BaseModel):
    total: int
    by_type: dict[str, int]
    total_applications: int
    unused_count: int
    most_used: list[DictionaryMostUsedResponse]
