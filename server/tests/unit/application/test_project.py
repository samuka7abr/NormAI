from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from application.projects.create_project import CreateProjectUseCase
from application.projects.delete_project import DeleteProjectUseCase
from application.projects.dtos import CreateProjectInput, ListProjectsInput, UpdateProjectInput
from application.projects.get_project import GetProjectUseCase
from application.projects.list_projects import ListProjectsUseCase
from application.projects.update_project import UpdateProjectUseCase
from domain.projects.entities import Project
from domain.projects.exceptions import ProjectNameAlreadyExists, ProjectNotFound
from domain.projects.repositories import ProjectRepository
from tests.unit.application._helpers import InMemoryActivityRepository


class InMemoryProjectRepository(ProjectRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Project] = {}

    async def create(self, project: Project) -> Project:
        for p in self._store.values():
            if p.user_id == project.user_id and p.name == project.name:
                raise ProjectNameAlreadyExists(f"Project '{project.name}' already exists")
        self._store[project.id] = project
        return project

    async def get_by_id(self, id: UUID, user_id: UUID) -> Project | None:
        p = self._store.get(id)
        if p and p.user_id == user_id:
            return p
        return None

    async def list_by_user(self, user_id: UUID, offset: int, limit: int) -> tuple[list[Project], int]:
        all_projects = [p for p in self._store.values() if p.user_id == user_id]
        return all_projects[offset : offset + limit], len(all_projects)

    async def update(self, project: Project) -> Project:
        for p in self._store.values():
            if p.user_id == project.user_id and p.name == project.name and p.id != project.id:
                raise ProjectNameAlreadyExists(f"Project '{project.name}' already exists")
        self._store[project.id] = project
        return project

    async def delete(self, id: UUID, user_id: UUID) -> None:
        del self._store[id]


def make_input(user_id: UUID, name: str = "Meu Projeto") -> CreateProjectInput:
    return CreateProjectInput(user_id=user_id, name=name, description="desc", ai_context="ctx")


async def test_create_ok():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    uc = CreateProjectUseCase(repo, activity_repo)
    user_id = uuid4()

    result = await uc.execute(make_input(user_id))

    assert result.name == "Meu Projeto"
    assert result.user_id == user_id


async def test_create_logs_activity():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    uc = CreateProjectUseCase(repo, activity_repo)
    user_id = uuid4()

    result = await uc.execute(make_input(user_id, "Meu Projeto"))

    assert len(activity_repo._store) == 1
    activity = activity_repo._store[0]
    assert activity.type == "project_created"
    assert activity.user_id == user_id
    assert activity.project_name == "Meu Projeto"


async def test_create_duplicate_raises():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    uc = CreateProjectUseCase(repo, activity_repo)
    user_id = uuid4()

    await uc.execute(make_input(user_id, "Projeto A"))

    with pytest.raises(ProjectNameAlreadyExists):
        await uc.execute(make_input(user_id, "Projeto A"))


async def test_create_same_name_different_user_ok():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    uc = CreateProjectUseCase(repo, activity_repo)

    await uc.execute(make_input(uuid4(), "Projeto A"))
    await uc.execute(make_input(uuid4(), "Projeto A"))  # usuário diferente — deve passar


async def test_get_ok():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    create_uc = CreateProjectUseCase(repo, activity_repo)
    get_uc = GetProjectUseCase(repo)
    user_id = uuid4()

    created = await create_uc.execute(make_input(user_id))
    result = await get_uc.execute(id=created.id, user_id=user_id)

    assert result.id == created.id


async def test_get_not_found_raises():
    repo = InMemoryProjectRepository()
    uc = GetProjectUseCase(repo)

    with pytest.raises(ProjectNotFound):
        await uc.execute(id=uuid4(), user_id=uuid4())


async def test_get_wrong_user_raises():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    create_uc = CreateProjectUseCase(repo, activity_repo)
    get_uc = GetProjectUseCase(repo)
    user_id = uuid4()

    created = await create_uc.execute(make_input(user_id))

    with pytest.raises(ProjectNotFound):
        await get_uc.execute(id=created.id, user_id=uuid4())  # usuário diferente


async def test_list_paginated():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    create_uc = CreateProjectUseCase(repo, activity_repo)
    list_uc = ListProjectsUseCase(repo)
    user_id = uuid4()

    for i in range(5):
        await create_uc.execute(make_input(user_id, f"Projeto {i}"))

    result = await list_uc.execute(ListProjectsInput(user_id=user_id, page=1, page_size=3))

    assert len(result.items) == 3
    assert result.total == 5
    assert result.total_pages == 2


async def test_update_ok():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    create_uc = CreateProjectUseCase(repo, activity_repo)
    update_uc = UpdateProjectUseCase(repo)
    user_id = uuid4()

    created = await create_uc.execute(make_input(user_id))
    result = await update_uc.execute(
        UpdateProjectInput(id=created.id, user_id=user_id, name="Novo Nome")
    )

    assert result.name == "Novo Nome"
    assert result.description == "desc"  # não alterado


async def test_update_not_found_raises():
    repo = InMemoryProjectRepository()
    uc = UpdateProjectUseCase(repo)

    with pytest.raises(ProjectNotFound):
        await uc.execute(UpdateProjectInput(id=uuid4(), user_id=uuid4(), name="X"))


async def test_delete_ok():
    repo = InMemoryProjectRepository()
    activity_repo = InMemoryActivityRepository()
    create_uc = CreateProjectUseCase(repo, activity_repo)
    delete_uc = DeleteProjectUseCase(repo)
    get_uc = GetProjectUseCase(repo)
    user_id = uuid4()

    created = await create_uc.execute(make_input(user_id))
    await delete_uc.execute(id=created.id, user_id=user_id)

    with pytest.raises(ProjectNotFound):
        await get_uc.execute(id=created.id, user_id=user_id)


async def test_delete_not_found_raises():
    repo = InMemoryProjectRepository()
    uc = DeleteProjectUseCase(repo)

    with pytest.raises(ProjectNotFound):
        await uc.execute(id=uuid4(), user_id=uuid4())
