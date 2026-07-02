import csv
import io
from datetime import datetime, timezone
from uuid import uuid4

from domain.activity.entities import ActivityType
from domain.activity.repositories import ActivityRepository
from domain.projects.repositories import ColumnConfigRepository, ProjectRepository
from domain.reports.entities import ApprovalStatus, ExecutionStatus, Report, ReportExecution
from domain.reports.exceptions import ColumnsMismatch, ReportNotFound  # noqa: F401
from domain.reports.repositories import ExecutionRepository, ReportRepository
from domain.shared.file_storage import FileStorage
from domain.shared.processing_queue import ProcessingQueue

from application.reports.dtos import ReportOutput, UploadReportInput, UploadReportOutput


def _read_headers(content: bytes, filename: str) -> list[str]:
    name = filename.lower()
    if name.endswith(".xlsx"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        headers = []
        for row in ws.iter_rows(max_row=1, values_only=True):
            headers = [str(c) for c in row if c is not None]
            break
        wb.close()
        return headers
    reader = csv.reader(io.StringIO(content.decode("utf-8", errors="replace")))
    for row in reader:
        return [h.strip() for h in row if h.strip()]
    return []


class UploadReportUseCase:
    def __init__(
        self,
        project_repo: ProjectRepository,
        column_config_repo: ColumnConfigRepository,
        report_repo: ReportRepository,
        execution_repo: ExecutionRepository,
        storage: FileStorage,
        queue: ProcessingQueue,
        activity_repo: ActivityRepository,
        max_upload_size_mb: int = 30,
    ) -> None:
        self._project_repo = project_repo
        self._column_config_repo = column_config_repo
        self._report_repo = report_repo
        self._execution_repo = execution_repo
        self._storage = storage
        self._queue = queue
        self._activity_repo = activity_repo
        self._max_bytes = max_upload_size_mb * 1024 * 1024

    async def execute(self, inp: UploadReportInput) -> UploadReportOutput:
        if len(inp.content) > self._max_bytes:
            raise ValueError(
                f"File exceeds maximum allowed size of {self._max_bytes // (1024 * 1024)} MB."
            )

        from domain.projects.exceptions import ProjectNotFound
        project = await self._project_repo.get_by_id(inp.project_id, inp.user_id)
        if project is None:
            raise ProjectNotFound(f"Project {inp.project_id} not found.")

        configs = await self._column_config_repo.list_by_project(inp.project_id)
        enabled_columns = {c.column_name for c in configs if c.enabled}

        file_headers = set(_read_headers(inp.content, inp.filename))
        missing = sorted(enabled_columns - file_headers)
        extra = sorted(file_headers - enabled_columns)

        if missing:
            raise ColumnsMismatch(missing=missing, extra=extra)

        now = datetime.now(timezone.utc)
        report_id = uuid4()
        ext = inp.filename.rsplit(".", 1)[-1] if "." in inp.filename else "bin"
        file_key = f"{inp.project_id}/{report_id}/original.{ext}"

        await self._storage.save(file_key, inp.content)

        report = Report(
            id=report_id,
            project_id=inp.project_id,
            original_filename=inp.filename,
            original_file_key=file_key,
            uploaded_at=now,
            approval_status=ApprovalStatus.PENDING,
            approval_reason=None,
            created_at=now,
            updated_at=now,
        )
        report = await self._report_repo.create(report)

        snapshot: dict = {
            c.column_name: {
                "enabled": c.enabled,
                "normalizations": c.normalizations,
                "classify": c.classify,
                "categories": c.categories,
            }
            for c in configs
        }
        snapshot["_project"] = {"ai_context": project.ai_context or ""}

        execution = ReportExecution(
            id=uuid4(),
            report_id=report.id,
            status=ExecutionStatus.QUEUED,
            progress_percent=0,
            current_step=None,
            started_at=None,
            finished_at=None,
            result_file_key=None,
            error_log=None,
            column_config_snapshot=snapshot,
            created_at=now,
            updated_at=now,
        )
        execution = await self._execution_repo.create(execution)

        await self._activity_repo.create(
            user_id=inp.user_id,
            project_id=inp.project_id,
            type=ActivityType.upload,
            project_name=project.name,
        )

        await self._activity_repo.create(
            user_id=inp.user_id,
            project_id=inp.project_id,
            type=ActivityType.processing_start,
            project_name=project.name,
        )

        await self._queue.enqueue_execution(execution.id)

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
        return UploadReportOutput(report=report_out, execution_id=execution.id, extra_columns=extra)
