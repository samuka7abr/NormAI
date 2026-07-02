from dataclasses import dataclass, field
from datetime import datetime
from math import ceil
from uuid import UUID

from domain.reports.entities import ApprovalStatus, ExecutionStatus


@dataclass
class UploadReportInput:
    project_id: UUID
    user_id: UUID
    filename: str
    content: bytes


@dataclass
class SubmitFeedbackInput:
    report_id: UUID
    project_id: UUID
    user_id: UUID
    approval_status: ApprovalStatus
    approval_reason: str | None = None


@dataclass
class ReportOutput:
    id: UUID
    project_id: UUID
    original_filename: str
    original_file_key: str
    uploaded_at: datetime
    approval_status: ApprovalStatus
    approval_reason: str | None
    created_at: datetime
    updated_at: datetime


@dataclass
class ReportWithLatestExecutionOutput:
    id: UUID
    project_id: UUID
    original_filename: str
    uploaded_at: datetime
    approval_status: ApprovalStatus
    latest_execution_status: ExecutionStatus | None
    latest_execution_id: UUID | None
    created_at: datetime
    updated_at: datetime


@dataclass
class ExecutionOutput:
    id: UUID
    report_id: UUID
    status: ExecutionStatus
    progress_percent: int
    current_step: str | None
    started_at: datetime | None
    finished_at: datetime | None
    result_file_key: str | None
    error_log: str | None
    created_at: datetime
    updated_at: datetime
    classification_metrics: dict | None = None


@dataclass
class UploadReportOutput:
    report: ReportOutput
    execution_id: UUID
    extra_columns: list[str] = field(default_factory=list)


@dataclass
class ListReportsInput:
    project_id: UUID
    user_id: UUID
    page: int
    page_size: int


@dataclass
class PaginatedReportsOutput:
    items: list[ReportWithLatestExecutionOutput]
    total: int
    page: int
    page_size: int
    total_pages: int

    @staticmethod
    def build(
        items: list[ReportWithLatestExecutionOutput],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedReportsOutput":
        return PaginatedReportsOutput(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=ceil(total / page_size) if page_size else 0,
        )


@dataclass
class ReportDetailOutput:
    report: ReportOutput
    executions: list[ExecutionOutput]
