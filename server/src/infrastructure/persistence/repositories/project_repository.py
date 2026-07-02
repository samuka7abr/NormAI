from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from domain.projects.entities import Project
from domain.projects.exceptions import ProjectNameAlreadyExists
from domain.projects.repositories import ProjectRepository
from infrastructure.persistence.models import ProjectModel, UserModel  # noqa: F401 — UserModel força registro da tabela users no metadata


class SqlAlchemyProjectRepository(ProjectRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, project: Project) -> Project:
        model = ProjectModel(
            id=project.id,
            user_id=project.user_id,
            name=project.name,
            description=project.description,
            ai_context=project.ai_context,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
        self._session.add(model)
        try:
            await self._session.flush()
        except IntegrityError:
            await self._session.rollback()
            raise ProjectNameAlreadyExists(f"Project '{project.name}' already exists")
        return model._to_entity()

    async def get_by_id(self, id: UUID, user_id: UUID) -> Project | None:
        stmt = select(ProjectModel).where(
            ProjectModel.id == id,
            ProjectModel.user_id == user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return model._to_entity() if model else None

    async def list_by_user(
        self, user_id: UUID, offset: int, limit: int
    ) -> tuple[list[Project], int]:
        stmt = (
            select(ProjectModel, func.count(ProjectModel.id).over().label("total"))
            .where(ProjectModel.user_id == user_id)
            .order_by(ProjectModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        rows = result.all()
        if not rows:
            return [], 0
        total = rows[0].total
        return [row.ProjectModel._to_entity() for row in rows], total

    async def update(self, project: Project) -> Project:
        stmt = select(ProjectModel).where(
            ProjectModel.id == project.id,
            ProjectModel.user_id == project.user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        model.name = project.name
        model.description = project.description
        model.ai_context = project.ai_context
        model.updated_at = project.updated_at
        try:
            await self._session.flush()
        except IntegrityError:
            await self._session.rollback()
            raise ProjectNameAlreadyExists(f"Project '{project.name}' already exists")
        return model._to_entity()

    async def delete(self, id: UUID, user_id: UUID) -> None:
        stmt = select(ProjectModel).where(
            ProjectModel.id == id,
            ProjectModel.user_id == user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        await self._session.delete(model)
        await self._session.flush()
