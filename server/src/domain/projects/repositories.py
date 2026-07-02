from abc import ABC, abstractmethod
from uuid import UUID

from domain.projects.entities import ColumnConfig, Project


class ProjectRepository(ABC):
    @abstractmethod
    async def create(self, project: Project) -> Project: ...

    @abstractmethod
    async def get_by_id(self, id: UUID, user_id: UUID) -> Project | None: ...

    @abstractmethod
    async def list_by_user(
        self, user_id: UUID, offset: int, limit: int
    ) -> tuple[list[Project], int]: ...

    @abstractmethod
    async def update(self, project: Project) -> Project: ...

    @abstractmethod
    async def delete(self, id: UUID, user_id: UUID) -> None: ...


class ColumnConfigRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: UUID, project_id: UUID) -> ColumnConfig | None: ...

    @abstractmethod
    async def list_by_project(self, project_id: UUID) -> list[ColumnConfig]: ...

    # replaces the entire set of columns for a project (idempotent PUT semantics)
    @abstractmethod
    async def upsert_all(
        self, project_id: UUID, configs: list[ColumnConfig]
    ) -> list[ColumnConfig]: ...

    @abstractmethod
    async def update(self, config: ColumnConfig) -> ColumnConfig: ...
