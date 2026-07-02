from uuid import UUID

from application.projects.dtos import ProjectOutput
from domain.projects.exceptions import ProjectNotFound
from domain.projects.repositories import ProjectRepository


class GetProjectUseCase:
    def __init__(self, repository: ProjectRepository) -> None:
        self._repo = repository

    async def execute(self, id: UUID, user_id: UUID) -> ProjectOutput:
        project = await self._repo.get_by_id(id, user_id)
        if project is None:
            raise ProjectNotFound(f"Project {id} not found")
        return ProjectOutput(
            id=project.id,
            user_id=project.user_id,
            name=project.name,
            description=project.description,
            ai_context=project.ai_context,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
