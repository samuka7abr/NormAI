from uuid import uuid4

import pytest

from application.activity.list_activities import ListActivitiesUseCase
from domain.activity.entities import ActivityType
from tests.unit.application._helpers import InMemoryActivityRepository


async def test_list_empty():
    repo = InMemoryActivityRepository()
    uc = ListActivitiesUseCase(repo)
    user_id = uuid4()

    result = await uc.execute(user_id=user_id)

    assert result.items == []
    assert result.total == 0


async def test_list_returns_user_activities():
    repo = InMemoryActivityRepository()
    uc = ListActivitiesUseCase(repo)
    user_id = uuid4()
    project_id = uuid4()

    await repo.create(
        user_id=user_id,
        project_id=project_id,
        type=ActivityType.project_created,
        project_name="Meu Projeto",
    )

    result = await uc.execute(user_id=user_id)

    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].type == "project_created"
    assert result.items[0].project_name == "Meu Projeto"
    assert result.items[0].project_id == project_id


async def test_list_isolates_by_user():
    repo = InMemoryActivityRepository()
    uc = ListActivitiesUseCase(repo)
    user_a = uuid4()
    user_b = uuid4()
    project_id = uuid4()

    await repo.create(
        user_id=user_a,
        project_id=project_id,
        type=ActivityType.project_created,
        project_name="Projeto A",
    )

    result = await uc.execute(user_id=user_b)

    assert result.items == []
    assert result.total == 0


async def test_list_limit_clamped_to_50():
    repo = InMemoryActivityRepository()
    uc = ListActivitiesUseCase(repo)
    user_id = uuid4()
    project_id = uuid4()

    for i in range(60):
        await repo.create(
            user_id=user_id,
            project_id=project_id,
            type=ActivityType.upload,
            project_name=f"Projeto {i}",
        )

    result = await uc.execute(user_id=user_id, limit=100)

    assert len(result.items) == 50
    assert result.total == 60


async def test_list_offset_pagination():
    repo = InMemoryActivityRepository()
    uc = ListActivitiesUseCase(repo)
    user_id = uuid4()
    project_id = uuid4()

    for i in range(5):
        await repo.create(
            user_id=user_id,
            project_id=project_id,
            type=ActivityType.upload,
            project_name=f"Projeto {i}",
        )

    result = await uc.execute(user_id=user_id, limit=3, offset=3)

    assert len(result.items) == 2
    assert result.total == 5


async def test_list_multiple_types():
    repo = InMemoryActivityRepository()
    uc = ListActivitiesUseCase(repo)
    user_id = uuid4()
    project_id = uuid4()

    await repo.create(user_id=user_id, project_id=project_id, type=ActivityType.project_created, project_name="P")
    await repo.create(user_id=user_id, project_id=project_id, type=ActivityType.upload, project_name="P")
    await repo.create(user_id=user_id, project_id=project_id, type=ActivityType.processing_start, project_name="P")

    result = await uc.execute(user_id=user_id)

    assert result.total == 3
    types = {item.type for item in result.items}
    assert types == {"project_created", "upload", "processing_start"}
