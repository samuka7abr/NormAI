from datetime import datetime, timezone

from application.projects.dtos import ColumnConfigOutput, UpdateColumnConfigInput
from domain.projects.exceptions import ColumnConfigNotFound
from domain.projects.repositories import ColumnConfigRepository


class UpdateColumnConfigUseCase:
    def __init__(self, column_repo: ColumnConfigRepository) -> None:
        self._column_repo = column_repo

    async def execute(self, input: UpdateColumnConfigInput) -> ColumnConfigOutput:
        config = await self._column_repo.get_by_id(input.id, input.project_id)
        if config is None:
            raise ColumnConfigNotFound(f"ColumnConfig {input.id} not found")

        if input.enabled is not None:
            config.enabled = input.enabled
        if input.normalizations is not None:
            config.normalizations = input.normalizations
        if input.classify is not None:
            config.classify = input.classify
        if input.categories is not None:
            config.categories = input.categories
        config.updated_at = datetime.now(timezone.utc)

        updated = await self._column_repo.update(config)
        return ColumnConfigOutput(
            id=updated.id,
            project_id=updated.project_id,
            column_name=updated.column_name,
            enabled=updated.enabled,
            normalizations=updated.normalizations,
            classify=updated.classify,
            categories=updated.categories,
            sample_values=updated.sample_values,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        )
