from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from domain.reports.entities import ApprovalStatus, ExecutionStatus


class UploadReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: UUID
    execution_id: UUID
    original_filename: str
    approval_status: ApprovalStatus
    extra_columns: list[str]


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    original_filename: str
    original_file_key: str
    uploaded_at: datetime
    approval_status: ApprovalStatus
    approval_reason: str | None
    created_at: datetime
    updated_at: datetime


class ReportListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    original_filename: str
    uploaded_at: datetime
    approval_status: ApprovalStatus
    latest_execution_status: ExecutionStatus | None
    latest_execution_id: UUID | None
    created_at: datetime
    updated_at: datetime


class PaginatedReportsResponse(BaseModel):
    items: list[ReportListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ExecutionStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_id: UUID
    status: ExecutionStatus
    progress_percent: int
    current_step: str | None
    started_at: datetime | None
    finished_at: datetime | None
    error_log: str | None
    created_at: datetime
    updated_at: datetime
    classification_metrics: dict | None = None


class ReportDetailResponse(BaseModel):
    report: ReportResponse
    executions: list[ExecutionStatusResponse]


class SubmitFeedbackRequest(BaseModel):
    approval_status: ApprovalStatus
    approval_reason: str | None = None
