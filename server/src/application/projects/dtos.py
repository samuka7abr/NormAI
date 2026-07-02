from dataclasses import dataclass, field
from datetime import datetime
from math import ceil
from uuid import UUID


@dataclass
class CreateProjectInput:
    user_id: UUID
    name: str
    description: str
    ai_context: str


@dataclass
class UpdateProjectInput:
    id: UUID
    user_id: UUID
    name: str | None = None
    description: str | None = None
    ai_context: str | None = None


@dataclass
class ProjectOutput:
    id: UUID
    user_id: UUID
    name: str
    description: str
    ai_context: str
    created_at: datetime
    updated_at: datetime


@dataclass
class ListProjectsInput:
    user_id: UUID
    page: int
    page_size: int


@dataclass
class PaginatedProjectsOutput:
    items: list[ProjectOutput]
    total: int
    page: int
    page_size: int
    total_pages: int

    @staticmethod
    def build(items: list[ProjectOutput], total: int, page: int, page_size: int) -> "PaginatedProjectsOutput":
        return PaginatedProjectsOutput(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=ceil(total / page_size) if page_size else 0,
        )


# ── ColumnConfig DTOs ──────────────────────────────────────────────────────────

@dataclass
class ColumnConfigInput:
    column_name: str
    enabled: bool = True
    normalizations: dict = field(default_factory=dict)
    classify: bool = False
    categories: list | None = None
    sample_values: list = field(default_factory=list)


@dataclass
class UpdateColumnConfigInput:
    id: UUID
    project_id: UUID
    enabled: bool | None = None
    normalizations: dict | None = None
    classify: bool | None = None
    categories: list | None = None


@dataclass
class ColumnConfigOutput:
    id: UUID
    project_id: UUID
    column_name: str
    enabled: bool
    normalizations: dict
    classify: bool
    categories: list | None
    sample_values: list
    created_at: datetime
    updated_at: datetime


@dataclass
class DetectedColumnOutput:
    column_name: str
    sample_values: list[str]
