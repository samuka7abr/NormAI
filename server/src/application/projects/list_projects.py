from application.projects.dtos import ListProjectsInput, PaginatedProjectsOutput, ProjectOutput
from domain.projects.repositories import ProjectRepository


class ListProjectsUseCase:
    def __init__(self, repository: ProjectRepository) -> None:
        self._repo = repository

    async def execute(self, input: ListProjectsInput) -> PaginatedProjectsOutput:
        page_size = min(input.page_size, 100)
        offset = (input.page - 1) * page_size

        projects, total = await self._repo.list_by_user(input.user_id, offset=offset, limit=page_size)

        items = [
            ProjectOutput(
                id=p.id,
                user_id=p.user_id,
                name=p.name,
                description=p.description,
                ai_context=p.ai_context,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in projects
        ]
        return PaginatedProjectsOutput.build(items=items, total=total, page=input.page, page_size=page_size)
