from datetime import datetime, timezone

from domain.reports.entities import ApprovalStatus
from domain.reports.exceptions import InvalidApprovalTransition, ReportNotFound
from domain.reports.repositories import ReportRepository

from application.reports.dtos import ReportOutput, SubmitFeedbackInput

_VALID_TRANSITIONS = {
    ApprovalStatus.PENDING: {ApprovalStatus.APPROVED, ApprovalStatus.REJECTED},
}


class SubmitFeedbackUseCase:
    def __init__(self, report_repo: ReportRepository) -> None:
        self._report_repo = report_repo

    async def execute(self, inp: SubmitFeedbackInput) -> ReportOutput:
        report = await self._report_repo.get_by_id(inp.report_id, inp.project_id)
        if report is None:
            raise ReportNotFound(f"Report {inp.report_id} not found.")

        allowed = _VALID_TRANSITIONS.get(report.approval_status, set())
        if inp.approval_status not in allowed:
            raise InvalidApprovalTransition(
                f"Cannot transition from {report.approval_status} to {inp.approval_status}."
            )

        report.approval_status = inp.approval_status
        report.approval_reason = inp.approval_reason
        report.updated_at = datetime.now(timezone.utc)

        report = await self._report_repo.update(report)

        return ReportOutput(
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
