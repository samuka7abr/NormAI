from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from application.projects.configure_columns import ConfigureColumnsUseCase
from application.projects.detect_columns import ColumnDetector, DetectColumnsUseCase
from application.projects.dtos import ColumnConfigInput, DetectedColumnOutput, UpdateColumnConfigInput
from application.projects.update_column_config import UpdateColumnConfigUseCase
from domain.projects.entities import ColumnConfig, Project
from domain.projects.exceptions import ColumnConfigNotFound, ProjectNotFound
from domain.projects.repositories import ColumnConfigRepository, ProjectRepository


# ── Fakes ──────────────────────────────────────────────────────────────────────

class FakeProjectRepository(ProjectRepository):
    def __init__(self, projects: list[Project]) -> None:
        self._store = {p.id: p for p in projects}

    async def create(self, project): return project
    async def get_by_id(self, id: UUID, user_id: UUID): return self._store.get(id)
    async def list_by_user(self, user_id, offset, limit): return [], 0
    async def update(self, project): return project
    async def delete(self, id, user_id): pass


class FakeColumnConfigRepository(ColumnConfigRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, ColumnConfig] = {}

    async def get_by_id(self, id: UUID, project_id: UUID):
        c = self._store.get(id)
        return c if c and c.project_id == project_id else None

    async def list_by_project(self, project_id: UUID):
        return [c for c in self._store.values() if c.project_id == project_id]

    async def upsert_all(self, project_id: UUID, configs: list[ColumnConfig]):
        self._store = {c.id: c for c in self._store.values() if c.project_id != project_id}
        for c in configs:
            self._store[c.id] = c
        return configs

    async def update(self, config: ColumnConfig):
        self._store[config.id] = config
        return config


class FakeColumnDetector(ColumnDetector):
    def detect(self, content: bytes, filename: str) -> list[DetectedColumnOutput]:
        lines = content.decode().splitlines()
        if not lines:
            return []
        headers = lines[0].split(",")
        samples: dict[str, list[str]] = {h: [] for h in headers}
        for line in lines[1:101]:
            for h, val in zip(headers, line.split(",")):
                if val and len(samples[h]) < 5 and val not in samples[h]:
                    samples[h].append(val)
        return [DetectedColumnOutput(column_name=k, sample_values=v) for k, v in samples.items()]


def make_project(user_id: UUID) -> Project:
    now = datetime.now(timezone.utc)
    return Project(id=uuid4(), user_id=user_id, name="P", description="", ai_context="", created_at=now, updated_at=now)


# ── ConfigureColumnsUseCase ────────────────────────────────────────────────────

async def test_configure_columns_ok():
    user_id = uuid4()
    project = make_project(user_id)
    project_repo = FakeProjectRepository([project])
    col_repo = FakeColumnConfigRepository()
    uc = ConfigureColumnsUseCase(project_repo, col_repo)

    result = await uc.execute(
        project.id, user_id,
        [ColumnConfigInput(column_name="nome"), ColumnConfigInput(column_name="cpf")]
    )
    assert len(result) == 2
    assert {r.column_name for r in result} == {"nome", "cpf"}


async def test_configure_columns_replaces_existing():
    user_id = uuid4()
    project = make_project(user_id)
    project_repo = FakeProjectRepository([project])
    col_repo = FakeColumnConfigRepository()
    uc = ConfigureColumnsUseCase(project_repo, col_repo)

    await uc.execute(project.id, user_id, [ColumnConfigInput(column_name="antigo")])
    result = await uc.execute(project.id, user_id, [ColumnConfigInput(column_name="novo")])

    assert len(result) == 1
    assert result[0].column_name == "novo"


async def test_configure_columns_project_not_found():
    user_id = uuid4()
    uc = ConfigureColumnsUseCase(FakeProjectRepository([]), FakeColumnConfigRepository())

    with pytest.raises(ProjectNotFound):
        await uc.execute(uuid4(), user_id, [ColumnConfigInput(column_name="col")])


async def test_configure_columns_empty_clears_all():
    user_id = uuid4()
    project = make_project(user_id)
    project_repo = FakeProjectRepository([project])
    col_repo = FakeColumnConfigRepository()
    uc = ConfigureColumnsUseCase(project_repo, col_repo)

    await uc.execute(project.id, user_id, [ColumnConfigInput(column_name="col")])
    result = await uc.execute(project.id, user_id, [])
    assert result == []


# ── UpdateColumnConfigUseCase ──────────────────────────────────────────────────

async def test_update_column_config_ok():
    user_id = uuid4()
    project = make_project(user_id)
    project_repo = FakeProjectRepository([project])
    col_repo = FakeColumnConfigRepository()
    configure_uc = ConfigureColumnsUseCase(project_repo, col_repo)
    update_uc = UpdateColumnConfigUseCase(col_repo)

    configured = await configure_uc.execute(project.id, user_id, [ColumnConfigInput(column_name="nome")])
    col_id = configured[0].id

    result = await update_uc.execute(UpdateColumnConfigInput(id=col_id, project_id=project.id, classify=True))
    assert result.classify is True
    assert result.column_name == "nome"  # imutável


async def test_update_column_config_not_found():
    col_repo = FakeColumnConfigRepository()
    uc = UpdateColumnConfigUseCase(col_repo)

    with pytest.raises(ColumnConfigNotFound):
        await uc.execute(UpdateColumnConfigInput(id=uuid4(), project_id=uuid4()))


# ── DetectColumnsUseCase ───────────────────────────────────────────────────────

async def test_detect_columns_csv():
    uc = DetectColumnsUseCase(FakeColumnDetector())
    csv_content = b"nome,cpf\nJoao,123\nMaria,456\n,789"
    result = uc.execute(csv_content, "dados.csv")
    names = [r.column_name for r in result]
    assert "nome" in names
    assert "cpf" in names


async def test_detect_columns_skips_null_samples():
    uc = DetectColumnsUseCase(FakeColumnDetector())
    csv_content = b"col_a,col_b\n,valor1\n,valor2\nvalor3,"
    result = uc.execute(csv_content, "dados.csv")
    col_a = next(r for r in result if r.column_name == "col_a")
    col_b = next(r for r in result if r.column_name == "col_b")
    assert "valor3" in col_a.sample_values
    assert "" not in col_a.sample_values
    assert "" not in col_b.sample_values


async def test_detect_columns_empty_file():
    uc = DetectColumnsUseCase(FakeColumnDetector())
    result = uc.execute(b"", "vazio.csv")
    assert result == []
