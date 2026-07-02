from uuid import UUID

from domain.reports.exceptions import ReportNotFound
from domain.reports.repositories import ExecutionRepository, ReportRepository

from application.reports.dtos import ExecutionOutput


class GetExecutionStatusUseCase:
    def __init__(self, report_repo: ReportRepository, execution_repo: ExecutionRepository) -> None:
        self._report_repo = report_repo
        self._execution_repo = execution_repo

    async def execute(self, report_id: UUID, execution_id: UUID, project_id: UUID) -> ExecutionOutput:
        report = await self._report_repo.get_by_id(report_id, project_id)
        if report is None:
            raise ReportNotFound(f"Report {report_id} not found.")

        execution = await self._execution_repo.get_by_id(execution_id, report_id)
        if execution is None:
            raise ReportNotFound(f"Execution {execution_id} not found.")

        return ExecutionOutput(
            id=execution.id,
            report_id=execution.report_id,
            status=execution.status,
            progress_percent=execution.progress_percent,
            current_step=execution.current_step,
            started_at=execution.started_at,
            finished_at=execution.finished_at,
            result_file_key=execution.result_file_key,
            error_log=execution.error_log,
            created_at=execution.created_at,
            updated_at=execution.updated_at,
            classification_metrics=execution.classification_metrics,
        )
