from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class Project:
    id: UUID
    user_id: UUID
    name: str
    description: str
    ai_context: str
    created_at: datetime
    updated_at: datetime


@dataclass
class ColumnConfig:
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
