from uuid import UUID

from domain.reports.exceptions import ReportNotFound
from domain.reports.repositories import ExecutionRepository, ReportRepository

from application.reports.dtos import ExecutionOutput, ReportDetailOutput, ReportOutput


class GetReportUseCase:
    def __init__(self, report_repo: ReportRepository, execution_repo: ExecutionRepository) -> None:
        self._report_repo = report_repo
        self._execution_repo = execution_repo

    async def execute(self, report_id: UUID, project_id: UUID) -> ReportDetailOutput:
        report = await self._report_repo.get_by_id(report_id, project_id)
        if report is None:
            raise ReportNotFound(f"Report {report_id} not found.")

        executions = await self._execution_repo.list_by_report(report_id)

        report_out = ReportOutput(
            id=report.id,
            project_id=report.project_id,
            original_filename=report.original_filename,
            original_file_key=report.original_file_key,
            uploaded_at=report.uploaded_at,
            approval_status=report.approval_status,
            approval_reason=report.approval_reason,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )
        executions_out = [
            ExecutionOutput(
                id=e.id,
                report_id=e.report_id,
                status=e.status,
                progress_percent=e.progress_percent,
                current_step=e.current_step,
                started_at=e.started_at,
                finished_at=e.finished_at,
                result_file_key=e.result_file_key,
                error_log=e.error_log,
                created_at=e.created_at,
                updated_at=e.updated_at,
                classification_metrics=e.classification_metrics,
            )
            for e in executions
        ]
        return ReportDetailOutput(report=report_out, executions=executions_out)
