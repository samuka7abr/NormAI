from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from domain.reports.entities import ApprovalStatus, ExecutionStatus, Report, ReportExecution
from infrastructure.persistence.base import Base, TimestampMixin


class ReportModel(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    approval_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_reports_project", "project_id"),
        Index("idx_reports_uploaded_at", "uploaded_at"),
    )

    def _to_entity(self) -> Report:
        return Report(
            id=self.id,
            project_id=self.project_id,
            original_filename=self.original_filename,
            original_file_key=self.original_file_key,
            uploaded_at=self.uploaded_at,
            approval_status=ApprovalStatus(self.approval_status),
            approval_reason=self.approval_reason,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class ReportExecutionModel(Base, TimestampMixin):
    __tablename__ = "report_executions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    report_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_step: Mapped[str | None] = mapped_column(String(32), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_file_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    column_config_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    classification_metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("idx_executions_report", "report_id"),
    )

    def _to_entity(self) -> ReportExecution:
        return ReportExecution(
            id=self.id,
            report_id=self.report_id,
            status=ExecutionStatus(self.status),
            progress_percent=self.progress_percent,
            current_step=self.current_step,
            started_at=self.started_at,
            finished_at=self.finished_at,
            result_file_key=self.result_file_key,
            error_log=self.error_log,
            column_config_snapshot=self.column_config_snapshot,
            created_at=self.created_at,
            updated_at=self.updated_at,
            classification_metrics=self.classification_metrics,
        )
