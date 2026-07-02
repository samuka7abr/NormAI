from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class ActivityType(str, Enum):
    project_created  = "project_created"
    upload           = "upload"
    processing_start = "processing_start"
    processing_done  = "processing_done"
    needs_action     = "needs_action"


@dataclass
class Activity:
    id: UUID
    user_id: UUID
    project_id: UUID
    type: str
    project_name: str
    created_at: datetime
