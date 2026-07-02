from datetime import datetime, timezone
from uuid import uuid4

from application.projects.dtos import CreateProjectInput, ProjectOutput
from domain.activity.entities import ActivityType
from domain.activity.repositories import ActivityRepository
from domain.projects.entities import Project
from domain.projects.repositories import ProjectRepository


class CreateProjectUseCase:
    def __init__(self, repository: ProjectRepository, activity_repo: ActivityRepository) -> None:
        self._repo = repository
        self._activity_repo = activity_repo

    async def execute(self, input: CreateProjectInput) -> ProjectOutput:
        if not input.name.strip():
            raise ValueError("Project name cannot be empty")

        now = datetime.now(timezone.utc)
        project = Project(
            id=uuid4(),
            user_id=input.user_id,
            name=input.name.strip(),
            description=input.description,
            ai_context=input.ai_context,
            created_at=now,
            updated_at=now,
        )
        created = await self._repo.create(project)

        await self._activity_repo.create(
            user_id=created.user_id,
            project_id=created.id,
            type=ActivityType.project_created,
            project_name=created.name,
        )

        return _to_output(created)


def _to_output(project: Project) -> ProjectOutput:
    return ProjectOutput(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        ai_context=project.ai_context,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )
