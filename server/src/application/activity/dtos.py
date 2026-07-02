from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class ActivityOutput:
    id: UUID
    type: str
    project_id: UUID
    project_name: str
    created_at: datetime


@dataclass
class ActivityListOutput:
    items: list[ActivityOutput]
    total: int
