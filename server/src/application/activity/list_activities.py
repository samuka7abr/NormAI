from uuid import UUID

from application.activity.dtos import ActivityListOutput, ActivityOutput
from domain.activity.repositories import ActivityRepository


class ListActivitiesUseCase:
    def __init__(self, repo: ActivityRepository) -> None:
        self._repo = repo

    async def execute(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> ActivityListOutput:
        limit = min(limit, 50)
        activities, total = await self._repo.list_by_user(user_id, limit=limit, offset=offset)
        items = [
            ActivityOutput(
                id=a.id,
                type=a.type,
                project_id=a.project_id,
                project_name=a.project_name,
                created_at=a.created_at,
            )
            for a in activities
        ]
        return ActivityListOutput(items=items, total=total)
