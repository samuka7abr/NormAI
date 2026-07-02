from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from application.activity.list_activities import ListActivitiesUseCase
from infrastructure.persistence.database import get_db
from infrastructure.persistence.repositories.activity_repository import SqlAlchemyActivityRepository


def get_activity_repo(db: AsyncSession = Depends(get_db)) -> SqlAlchemyActivityRepository:
    return SqlAlchemyActivityRepository(db)


def get_list_activities_use_case(
    repo: SqlAlchemyActivityRepository = Depends(get_activity_repo),
) -> ListActivitiesUseCase:
    return ListActivitiesUseCase(repo)
