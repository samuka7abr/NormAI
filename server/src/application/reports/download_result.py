from collections.abc import AsyncIterator
from uuid import UUID

from domain.reports.entities import ExecutionStatus
from domain.reports.exceptions import ReportNotFound, ReportNotReady
from domain.reports.repositories import ExecutionRepository, ReportRepository
from domain.shared.file_storage import FileStorage


class DownloadResultUseCase:
    def __init__(
        self,
        report_repo: ReportRepository,
        execution_repo: ExecutionRepository,
        storage: FileStorage,
    ) -> None:
        self._report_repo = report_repo
        self._execution_repo = execution_repo
        self._storage = storage

    async def get_presigned_url(self, report_id: UUID, execution_id: UUID, project_id: UUID) -> str:
        execution = await self._get_ready_execution(report_id, execution_id, project_id)
        return await self._storage.generate_presigned_url(execution.result_file_key)  # type: ignore[arg-type]

    async def get_stream(
        self, report_id: UUID, execution_id: UUID, project_id: UUID
    ) -> AsyncIterator[bytes]:
        execution = await self._get_ready_execution(report_id, execution_id, project_id)
        return self._storage.load_stream(execution.result_file_key)  # type: ignore[arg-type]

    async def _get_ready_execution(self, report_id: UUID, execution_id: UUID, project_id: UUID):
        report = await self._report_repo.get_by_id(report_id, project_id)
        if report is None:
            raise ReportNotFound(f"Report {report_id} not found.")

        execution = await self._execution_repo.get_by_id(execution_id, report_id)
        if execution is None:
            raise ReportNotFound(f"Execution {execution_id} not found.")

        if execution.status != ExecutionStatus.READY:
            raise ReportNotReady(f"Execution {execution_id} is not READY (status={execution.status}).")

        return execution
