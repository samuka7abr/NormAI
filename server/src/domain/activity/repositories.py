from abc import ABC, abstractmethod
from uuid import UUID

from domain.activity.entities import Activity, ActivityType


class ActivityRepository(ABC):

    @abstractmethod
    async def create(
        self,
        user_id: UUID,
        project_id: UUID,
        type: ActivityType,
        project_name: str,
    ) -> Activity: ...

    @abstractmethod
    async def list_by_user(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Activity], int]: ...
