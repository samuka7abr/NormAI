from abc import ABC, abstractmethod
from uuid import UUID

from domain.reports.entities import Report, ReportExecution


class ReportRepository(ABC):
    @abstractmethod
    async def create(self, report: Report) -> Report: ...

    @abstractmethod
    async def get_by_id(self, id: UUID, project_id: UUID) -> Report | None: ...

    @abstractmethod
    async def get_by_id_internal(self, id: UUID) -> Report | None:
        """Busca sem filtro de project_id — uso exclusivo do worker."""

    @abstractmethod
    async def list_by_project(
        self, project_id: UUID, offset: int, limit: int
    ) -> tuple[list[Report], int]: ...

    @abstractmethod
    async def update(self, report: Report) -> Report: ...


class ExecutionRepository(ABC):
    @abstractmethod
    async def create(self, execution: ReportExecution) -> ReportExecution: ...

    @abstractmethod
    async def get_by_id(self, id: UUID, report_id: UUID) -> ReportExecution | None: ...

    @abstractmethod
    async def get_by_id_no_report_check(self, id: UUID) -> ReportExecution | None:
        """Busca sem filtro de report_id — uso exclusivo do worker."""

    @abstractmethod
    async def list_by_report(self, report_id: UUID) -> list[ReportExecution]: ...

    @abstractmethod
    async def get_latest_by_report(self, report_id: UUID) -> ReportExecution | None: ...

    @abstractmethod
    async def update(self, execution: ReportExecution) -> ReportExecution: ...
