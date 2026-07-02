from datetime import datetime, timezone
from uuid import UUID, uuid4

from application.projects.dtos import ColumnConfigInput, ColumnConfigOutput
from domain.projects.entities import ColumnConfig
from domain.projects.exceptions import ProjectNotFound
from domain.projects.repositories import ColumnConfigRepository, ProjectRepository


class ConfigureColumnsUseCase:
    def __init__(self, project_repo: ProjectRepository, column_repo: ColumnConfigRepository) -> None:
        self._project_repo = project_repo
        self._column_repo = column_repo

    async def execute(
        self, project_id: UUID, user_id: UUID, inputs: list[ColumnConfigInput]
    ) -> list[ColumnConfigOutput]:
        project = await self._project_repo.get_by_id(project_id, user_id)
        if project is None:
            raise ProjectNotFound(f"Project {project_id} not found")

        now = datetime.now(timezone.utc)
        configs = [
            ColumnConfig(
                id=uuid4(),
                project_id=project_id,
                column_name=inp.column_name,
                enabled=inp.enabled,
                normalizations=inp.normalizations,
                classify=inp.classify,
                categories=inp.categories,
                sample_values=inp.sample_values,
                created_at=now,
                updated_at=now,
            )
            for inp in inputs
        ]
        saved = await self._column_repo.upsert_all(project_id, configs)
        return [_to_output(c) for c in saved]


def _to_output(c: ColumnConfig) -> ColumnConfigOutput:
    return ColumnConfigOutput(
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
