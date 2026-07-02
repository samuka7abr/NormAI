from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import UUID


class DictionaryEntryKind(str, Enum):
    mappings = "mappings"
    categories = "categories"
    context = "context"


@dataclass
class DictionaryMostUsed:
    id: UUID
    title: str
    type: str
    used_count: int


@dataclass
class DictionaryStats:
    total: int
    by_type: dict[str, int]
    total_applications: int
    unused_count: int
    most_used: list[DictionaryMostUsed]


@dataclass
class DictionaryEntry:
    id: UUID
    user_id: UUID
    project_id: UUID | None  # None = global; set = project-scoped (project overrides global)
    kind: DictionaryEntryKind
    name: str
    description: str
    payload: dict
    created_at: datetime
    updated_at: datetime
    used_in: list[UUID] = field(default_factory=list)
