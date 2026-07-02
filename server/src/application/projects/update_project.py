from datetime import datetime, timezone

from application.projects.dtos import ProjectOutput, UpdateProjectInput
from domain.projects.exceptions import ProjectNotFound
from domain.projects.repositories import ProjectRepository


class UpdateProjectUseCase:
    def __init__(self, repository: ProjectRepository) -> None:
        self._repo = repository

    async def execute(self, input: UpdateProjectInput) -> ProjectOutput:
        project = await self._repo.get_by_id(input.id, input.user_id)
        if project is None:
            raise ProjectNotFound(f"Project {input.id} not found")

        if input.name is not None:
            if not input.name.strip():
                raise ValueError("Project name cannot be empty")
            project.name = input.name.strip()

        if input.description is not None:
            project.description = input.description

        if input.ai_context is not None:
            project.ai_context = input.ai_context

        project.updated_at = datetime.now(timezone.utc)

        updated = await self._repo.update(project)
        return ProjectOutput(
            id=updated.id,
            user_id=updated.user_id,
            name=updated.name,
            description=updated.description,
            ai_context=updated.ai_context,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        )
