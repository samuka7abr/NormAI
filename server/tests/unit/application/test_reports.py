from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from application.reports.dtos import SubmitFeedbackInput, UploadReportInput
from application.reports.download_result import DownloadResultUseCase
from application.reports.get_execution_status import GetExecutionStatusUseCase
from application.reports.get_report import GetReportUseCase
from application.reports.list_reports import ListReportsUseCase
from application.reports.reprocess_report import ReprocessReportUseCase
from application.reports.submit_feedback import SubmitFeedbackUseCase
from application.reports.upload_report import UploadReportUseCase
from domain.projects.entities import ColumnConfig, Project
from tests.unit.application._helpers import InMemoryActivityRepository
from domain.projects.exceptions import ProjectNotFound
from domain.projects.repositories import ColumnConfigRepository, ProjectRepository
from domain.reports.entities import ApprovalStatus, ExecutionStatus, Report, ReportExecution
from domain.reports.exceptions import (
    ColumnsMismatch,
    InvalidApprovalTransition,
    ReportNotFound,
    ReportNotReady,
)
from domain.reports.repositories import ExecutionRepository, ReportRepository
from domain.shared.file_storage import FileStorage
from domain.shared.processing_queue import ProcessingQueue


# ── Fakes ──────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


class FakeProjectRepository(ProjectRepository):
    def __init__(self, projects: list[Project]) -> None:
        self._store = {p.id: p for p in projects}

    async def create(self, p): return p
    async def get_by_id(self, id: UUID, user_id: UUID): return self._store.get(id)
    async def list_by_user(self, user_id, offset, limit): return [], 0
    async def update(self, p): return p
    async def delete(self, id, user_id): pass


class FakeColumnConfigRepository(ColumnConfigRepository):
    def __init__(self, configs: list[ColumnConfig] | None = None) -> None:
        self._store: dict[UUID, ColumnConfig] = {c.id: c for c in (configs or [])}

    async def get_by_id(self, id, project_id):
        c = self._store.get(id)
        return c if c and c.project_id == project_id else None

    async def list_by_project(self, project_id):
        return [c for c in self._store.values() if c.project_id == project_id]

    async def upsert_all(self, project_id, configs):
        self._store = {c.id: c for c in self._store.values() if c.project_id != project_id}
        for c in configs:
            self._store[c.id] = c
        return configs

    async def update(self, config):
        self._store[config.id] = config
        return config


class FakeReportRepository(ReportRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, Report] = {}

    async def create(self, report: Report) -> Report:
        self._store[report.id] = report
        return report

    async def get_by_id(self, id: UUID, project_id: UUID) -> Report | None:
        r = self._store.get(id)
        return r if r and r.project_id == project_id else None

    async def get_by_id_internal(self, id: UUID) -> Report | None:
        return self._store.get(id)

    async def list_by_project(self, project_id: UUID, offset: int, limit: int):
        items = [r for r in self._store.values() if r.project_id == project_id]
        return items[offset:offset + limit], len(items)

    async def update(self, report: Report) -> Report:
        self._store[report.id] = report
        return report


class FakeExecutionRepository(ExecutionRepository):
    def __init__(self) -> None:
        self._store: dict[UUID, ReportExecution] = {}

    async def create(self, execution: ReportExecution) -> ReportExecution:
        self._store[execution.id] = execution
        return execution

    async def get_by_id(self, id: UUID, report_id: UUID) -> ReportExecution | None:
        e = self._store.get(id)
        return e if e and e.report_id == report_id else None

    async def get_by_id_no_report_check(self, id: UUID) -> ReportExecution | None:
        return self._store.get(id)

    async def list_by_report(self, report_id: UUID) -> list[ReportExecution]:
        return [e for e in self._store.values() if e.report_id == report_id]

    async def get_latest_by_report(self, report_id: UUID) -> ReportExecution | None:
        items = [e for e in self._store.values() if e.report_id == report_id]
        return sorted(items, key=lambda e: e.created_at, reverse=True)[0] if items else None

    async def update(self, execution: ReportExecution) -> ReportExecution:
        self._store[execution.id] = execution
        return execution


class FakeFileStorage(FileStorage):
    def __init__(self) -> None:
        self._store: dict[str, bytes] = {}

    async def save(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        self._store[key] = data
        return key

    async def load_stream(self, key: str):
        async def _gen():
            yield self._store[key]
        return _gen()

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return f"https://fake-storage/{key}"


class FakeQueue(ProcessingQueue):
    def __init__(self) -> None:
        self.enqueued: list[UUID] = []

    async def enqueue_execution(self, execution_id: UUID) -> None:
        self.enqueued.append(execution_id)


def make_project(user_id: UUID, project_id: UUID | None = None) -> Project:
    n = _now()
    return Project(id=project_id or uuid4(), user_id=user_id, name="P", description="", ai_context="", created_at=n, updated_at=n)


def make_column_config(project_id: UUID, name: str = "col_a") -> ColumnConfig:
    n = _now()
    return ColumnConfig(id=uuid4(), project_id=project_id, column_name=name, enabled=True,
                        normalizations={}, classify=False, categories=None, sample_values=[], created_at=n, updated_at=n)


CSV_BYTES = b"col_a,col_b\nval1,val2\nval3,val4\n"


# ── UploadReportUseCase ────────────────────────────────────────────────────────

async def test_upload_report_ok():
    user_id = uuid4()
    project = make_project(user_id)
    col_a = make_column_config(project.id, "col_a")
    col_b = make_column_config(project.id, "col_b")
    queue = FakeQueue()

    uc = UploadReportUseCase(
        project_repo=FakeProjectRepository([project]),
        column_config_repo=FakeColumnConfigRepository([col_a, col_b]),
        report_repo=FakeReportRepository(),
        execution_repo=FakeExecutionRepository(),
        storage=FakeFileStorage(),
        queue=queue,
        activity_repo=InMemoryActivityRepository(),
    )
    result = await uc.execute(UploadReportInput(
        project_id=project.id, user_id=user_id, filename="dados.csv", content=CSV_BYTES
    ))

    assert result.report.project_id == project.id
    assert result.extra_columns == []
    assert len(queue.enqueued) == 1
    assert queue.enqueued[0] == result.execution_id


async def test_upload_report_columns_mismatch_raises():
    user_id = uuid4()
    project = make_project(user_id)
    col_a = make_column_config(project.id, "col_a")
    col_missing = make_column_config(project.id, "col_missing")

    uc = UploadReportUseCase(
        project_repo=FakeProjectRepository([project]),
        column_config_repo=FakeColumnConfigRepository([col_a, col_missing]),
        report_repo=FakeReportRepository(),
        execution_repo=FakeExecutionRepository(),
        storage=FakeFileStorage(),
        queue=FakeQueue(),
        activity_repo=InMemoryActivityRepository(),
    )
    with pytest.raises(ColumnsMismatch) as exc_info:
        await uc.execute(UploadReportInput(
            project_id=project.id, user_id=user_id, filename="dados.csv", content=CSV_BYTES
        ))
    assert "col_missing" in exc_info.value.missing


async def test_upload_report_extra_columns_allowed():
    user_id = uuid4()
    project = make_project(user_id)
    col_a = make_column_config(project.id, "col_a")

    uc = UploadReportUseCase(
        project_repo=FakeProjectRepository([project]),
        column_config_repo=FakeColumnConfigRepository([col_a]),
        report_repo=FakeReportRepository(),
        execution_repo=FakeExecutionRepository(),
        storage=FakeFileStorage(),
        queue=FakeQueue(),
        activity_repo=InMemoryActivityRepository(),
    )
    result = await uc.execute(UploadReportInput(
        project_id=project.id, user_id=user_id, filename="dados.csv", content=CSV_BYTES
    ))
    assert "col_b" in result.extra_columns


async def test_upload_report_project_not_found():
    user_id = uuid4()
    uc = UploadReportUseCase(
        project_repo=FakeProjectRepository([]),
        column_config_repo=FakeColumnConfigRepository(),
        report_repo=FakeReportRepository(),
        execution_repo=FakeExecutionRepository(),
        storage=FakeFileStorage(),
        queue=FakeQueue(),
        activity_repo=InMemoryActivityRepository(),
    )
    with pytest.raises(ProjectNotFound):
        await uc.execute(UploadReportInput(
            project_id=uuid4(), user_id=user_id, filename="dados.csv", content=CSV_BYTES
        ))


async def test_upload_report_exceeds_size_limit():
    user_id = uuid4()
    project = make_project(user_id)
    uc = UploadReportUseCase(
        project_repo=FakeProjectRepository([project]),
        column_config_repo=FakeColumnConfigRepository(),
        report_repo=FakeReportRepository(),
        execution_repo=FakeExecutionRepository(),
        storage=FakeFileStorage(),
        queue=FakeQueue(),
        activity_repo=InMemoryActivityRepository(),
        max_upload_size_mb=0,
    )
    with pytest.raises(ValueError, match="exceeds maximum"):
        await uc.execute(UploadReportInput(
            project_id=project.id, user_id=user_id, filename="dados.csv", content=CSV_BYTES
        ))


# ── SubmitFeedbackUseCase ──────────────────────────────────────────────────────

def _make_report(project_id: UUID) -> Report:
    n = _now()
    return Report(id=uuid4(), project_id=project_id, original_filename="f.csv",
                  original_file_key="k", uploaded_at=n,
                  approval_status=ApprovalStatus.PENDING, approval_reason=None, created_at=n, updated_at=n)


async def test_submit_feedback_approve():
    project_id = uuid4()
    report = _make_report(project_id)
    repo = FakeReportRepository()
    await repo.create(report)

    uc = SubmitFeedbackUseCase(repo)
    result = await uc.execute(SubmitFeedbackInput(
        report_id=report.id, project_id=project_id, user_id=uuid4(),
        approval_status=ApprovalStatus.APPROVED,
    ))
    assert result.approval_status == ApprovalStatus.APPROVED


async def test_submit_feedback_invalid_transition():
    project_id = uuid4()
    report = _make_report(project_id)
    report.approval_status = ApprovalStatus.APPROVED
    repo = FakeReportRepository()
    await repo.create(report)

    uc = SubmitFeedbackUseCase(repo)
    with pytest.raises(InvalidApprovalTransition):
        await uc.execute(SubmitFeedbackInput(
            report_id=report.id, project_id=project_id, user_id=uuid4(),
            approval_status=ApprovalStatus.REJECTED,
        ))


async def test_submit_feedback_not_found():
    uc = SubmitFeedbackUseCase(FakeReportRepository())
    with pytest.raises(ReportNotFound):
        await uc.execute(SubmitFeedbackInput(
            report_id=uuid4(), project_id=uuid4(), user_id=uuid4(),
            approval_status=ApprovalStatus.APPROVED,
        ))


# ── DownloadResultUseCase ──────────────────────────────────────────────────────

def _make_ready_execution(report_id: UUID) -> ReportExecution:
    n = _now()
    return ReportExecution(id=uuid4(), report_id=report_id, status=ExecutionStatus.READY,
                           progress_percent=100, current_step=None, started_at=n, finished_at=n,
                           result_file_key="result/key.csv", error_log=None,
                           column_config_snapshot={}, created_at=n, updated_at=n)


async def test_download_result_ok():
    project_id = uuid4()
    report = _make_report(project_id)
    execution = _make_ready_execution(report.id)

    report_repo = FakeReportRepository()
    await report_repo.create(report)
    exec_repo = FakeExecutionRepository()
    await exec_repo.create(execution)

    uc = DownloadResultUseCase(report_repo, exec_repo, FakeFileStorage())
    url = await uc.get_presigned_url(report.id, execution.id, project_id)
    assert "result/key.csv" in url


async def test_download_result_not_ready():
    project_id = uuid4()
    report = _make_report(project_id)
    n = _now()
    execution = ReportExecution(id=uuid4(), report_id=report.id, status=ExecutionStatus.PROCESSING,
                                progress_percent=50, current_step=None, started_at=n, finished_at=None,
                                result_file_key=None, error_log=None,
                                column_config_snapshot={}, created_at=n, updated_at=n)

    report_repo = FakeReportRepository()
    await report_repo.create(report)
    exec_repo = FakeExecutionRepository()
    await exec_repo.create(execution)

    uc = DownloadResultUseCase(report_repo, exec_repo, FakeFileStorage())
    with pytest.raises(ReportNotReady):
        await uc.get_presigned_url(report.id, execution.id, project_id)


# ── ReprocessReportUseCase ─────────────────────────────────────────────────────

async def test_reprocess_report_creates_new_execution():
    project_id = uuid4()
    report = _make_report(project_id)
    col = make_column_config(project_id, "col_a")
    queue = FakeQueue()

    report_repo = FakeReportRepository()
    await report_repo.create(report)
    exec_repo = FakeExecutionRepository()

    uc = ReprocessReportUseCase(
        report_repo=report_repo,
        execution_repo=exec_repo,
        column_config_repo=FakeColumnConfigRepository([col]),
        queue=queue,
    )
    result = await uc.execute(report_id=report.id, project_id=project_id)
    assert result.status == ExecutionStatus.QUEUED
    assert len(queue.enqueued) == 1


async def test_reprocess_report_not_found():
    uc = ReprocessReportUseCase(
        report_repo=FakeReportRepository(),
        execution_repo=FakeExecutionRepository(),
        column_config_repo=FakeColumnConfigRepository(),
        queue=FakeQueue(),
    )
    with pytest.raises(ReportNotFound):
        await uc.execute(report_id=uuid4(), project_id=uuid4())


# ── ProcessReportUseCase (worker) ──────────────────────────────────────────────

from application.reports.process_report import ProcessReportUseCase
from application.reports.report_processor import ProcessingResult, ReportProcessor


class FakeReportProcessor(ReportProcessor):
    async def process(self, content, original_filename, column_config_snapshot) -> ProcessingResult:
        return ProcessingResult(
            content=content + b"_processed",
            filename="result_" + original_filename,
            content_type="text/csv",
        )


class FailingReportProcessor(ReportProcessor):
    async def process(self, content, original_filename, column_config_snapshot) -> ProcessingResult:
        raise RuntimeError("processing failed")


def _make_queued_execution(report_id: UUID) -> ReportExecution:
    n = _now()
    return ReportExecution(id=uuid4(), report_id=report_id, status=ExecutionStatus.QUEUED,
                           progress_percent=0, current_step=None, started_at=None, finished_at=None,
                           result_file_key=None, error_log=None,
                           column_config_snapshot={}, created_at=n, updated_at=n)


async def test_process_report_transitions_to_ready():
    project_id = uuid4()
    report = _make_report(project_id)
    execution = _make_queued_execution(report.id)

    storage = FakeFileStorage()
    await storage.save(report.original_file_key, b"col_a\nval1\n")

    report_repo = FakeReportRepository()
    await report_repo.create(report)
    exec_repo = FakeExecutionRepository()
    await exec_repo.create(execution)

    uc = ProcessReportUseCase(report_repo, exec_repo, storage, FakeReportProcessor())
    await uc.execute(execution.id)

    updated = await exec_repo.get_by_id_no_report_check(execution.id)
    assert updated.status == ExecutionStatus.READY
    assert updated.result_file_key is not None
    assert updated.finished_at is not None
    assert updated.progress_percent == 100


async def test_process_report_transitions_to_error_on_failure():
    project_id = uuid4()
    report = _make_report(project_id)
    execution = _make_queued_execution(report.id)

    storage = FakeFileStorage()
    await storage.save(report.original_file_key, b"col_a\nval1\n")

    report_repo = FakeReportRepository()
    await report_repo.create(report)
    exec_repo = FakeExecutionRepository()
    await exec_repo.create(execution)

    uc = ProcessReportUseCase(report_repo, exec_repo, storage, FailingReportProcessor())
    await uc.execute(execution.id)

    updated = await exec_repo.get_by_id_no_report_check(execution.id)
    assert updated.status == ExecutionStatus.ERROR
    assert "processing failed" in (updated.error_log or "")
    assert updated.finished_at is not None


async def test_process_report_execution_not_found():
    uc = ProcessReportUseCase(
        FakeReportRepository(), FakeExecutionRepository(), FakeFileStorage(), FakeReportProcessor()
    )
    with pytest.raises(ReportNotFound):
        await uc.execute(uuid4())
