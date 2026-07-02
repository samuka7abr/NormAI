from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.projects.entities import ColumnConfig
from domain.projects.repositories import ColumnConfigRepository
from infrastructure.persistence.models import ColumnConfigModel, ProjectModel  # noqa: F401


class SqlAlchemyColumnConfigRepository(ColumnConfigRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, id: UUID, project_id: UUID) -> ColumnConfig | None:
        stmt = select(ColumnConfigModel).where(
            ColumnConfigModel.id == id,
            ColumnConfigModel.project_id == project_id,
        )
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return model._to_entity() if model else None

    async def list_by_project(self, project_id: UUID) -> list[ColumnConfig]:
        stmt = (
            select(ColumnConfigModel)
            .where(ColumnConfigModel.project_id == project_id)
            .order_by(ColumnConfigModel.column_name)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [r._to_entity() for r in rows]

    async def upsert_all(self, project_id: UUID, configs: list[ColumnConfig]) -> list[ColumnConfig]:
        await self._session.execute(
            delete(ColumnConfigModel).where(ColumnConfigModel.project_id == project_id)
        )
        models = [
            ColumnConfigModel(
                id=c.id,
                project_id=c.project_id,
                column_name=c.column_name,
                enabled=c.enabled,
                normalizations=c.normalizations,
                classify=c.classify,
                categories=c.categories,
                sample_values=c.sample_values,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in configs
        ]
        self._session.add_all(models)
        await self._session.flush()
        return [m._to_entity() for m in models]

    async def update(self, config: ColumnConfig) -> ColumnConfig:
        stmt = select(ColumnConfigModel).where(
            ColumnConfigModel.id == config.id,
            ColumnConfigModel.project_id == config.project_id,
        )
        model = (await self._session.execute(stmt)).scalar_one()
        model.enabled = config.enabled
        model.normalizations = config.normalizations
        model.classify = config.classify
        model.categories = config.categories
        model.updated_at = config.updated_at
        await self._session.flush()
        return model._to_entity()
