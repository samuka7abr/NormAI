from uuid import UUID

from domain.projects.exceptions import ProjectNotFound
from domain.projects.repositories import ProjectRepository


class DeleteProjectUseCase:
    def __init__(self, repository: ProjectRepository) -> None:
        self._repo = repository

    async def execute(self, id: UUID, user_id: UUID) -> None:
        project = await self._repo.get_by_id(id, user_id)
        if project is None:
            raise ProjectNotFound(f"Project {id} not found")
        await self._repo.delete(id, user_id)
