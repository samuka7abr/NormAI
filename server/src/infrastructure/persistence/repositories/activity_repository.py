from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.activity.entities import Activity, ActivityType
from domain.activity.repositories import ActivityRepository
from infrastructure.persistence.models.activity import ActivityModel


class SqlAlchemyActivityRepository(ActivityRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: UUID,
        project_id: UUID,
        type: ActivityType,
        project_name: str,
    ) -> Activity:
        now = datetime.now(timezone.utc)
        model = ActivityModel(
            id=uuid4(),
            user_id=user_id,
            project_id=project_id,
            type=type.value,
            project_name=project_name,
            created_at=now,
        )
        self._session.add(model)
        await self._session.flush()
        return model._to_entity()

    async def list_by_user(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Activity], int]:
        stmt = (
            select(ActivityModel, func.count(ActivityModel.id).over().label("total"))
            .where(ActivityModel.user_id == user_id)
            .order_by(ActivityModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        rows = result.all()
        if not rows:
            return [], 0
        total = rows[0].total
        return [row.ActivityModel._to_entity() for row in rows], total
