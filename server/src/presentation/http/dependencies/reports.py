from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from application.reports.download_result import DownloadResultUseCase
from application.reports.get_execution_status import GetExecutionStatusUseCase
from application.reports.get_report import GetReportUseCase
from application.reports.list_reports import ListReportsUseCase
from application.reports.reprocess_report import ReprocessReportUseCase
from application.reports.submit_feedback import SubmitFeedbackUseCase
from application.reports.upload_report import UploadReportUseCase
from infrastructure.persistence.database import get_db
from infrastructure.persistence.repositories.activity_repository import SqlAlchemyActivityRepository
from infrastructure.persistence.repositories.column_config_repository import SqlAlchemyColumnConfigRepository
from infrastructure.persistence.repositories.execution_repository import SqlAlchemyExecutionRepository
from infrastructure.persistence.repositories.project_repository import SqlAlchemyProjectRepository
from infrastructure.persistence.repositories.report_repository import SqlAlchemyReportRepository
from infrastructure.queue.celery_queue import CeleryProcessingQueue
from infrastructure.settings import get_settings
from infrastructure.storage.s3_file_storage import S3FileStorage

_queue = CeleryProcessingQueue()


def _get_storage() -> S3FileStorage:
    return S3FileStorage(get_settings())


def get_upload_report_use_case(db: AsyncSession = Depends(get_db)) -> UploadReportUseCase:
    s = get_settings()
    return UploadReportUseCase(
        project_repo=SqlAlchemyProjectRepository(db),
        column_config_repo=SqlAlchemyColumnConfigRepository(db),
        report_repo=SqlAlchemyReportRepository(db),
        execution_repo=SqlAlchemyExecutionRepository(db),
        storage=_get_storage(),
        queue=_queue,
        activity_repo=SqlAlchemyActivityRepository(db),
        max_upload_size_mb=s.max_upload_size_mb,
    )


def get_list_reports_use_case(db: AsyncSession = Depends(get_db)) -> ListReportsUseCase:
    return ListReportsUseCase(
        project_repo=SqlAlchemyProjectRepository(db),
        report_repo=SqlAlchemyReportRepository(db),
        execution_repo=SqlAlchemyExecutionRepository(db),
    )


def get_get_report_use_case(db: AsyncSession = Depends(get_db)) -> GetReportUseCase:
    return GetReportUseCase(
        report_repo=SqlAlchemyReportRepository(db),
        execution_repo=SqlAlchemyExecutionRepository(db),
    )


def get_execution_status_use_case(db: AsyncSession = Depends(get_db)) -> GetExecutionStatusUseCase:
    return GetExecutionStatusUseCase(
        report_repo=SqlAlchemyReportRepository(db),
        execution_repo=SqlAlchemyExecutionRepository(db),
    )


def get_download_result_use_case(db: AsyncSession = Depends(get_db)) -> DownloadResultUseCase:
    return DownloadResultUseCase(
        report_repo=SqlAlchemyReportRepository(db),
        execution_repo=SqlAlchemyExecutionRepository(db),
        storage=_get_storage(),
    )


def get_submit_feedback_use_case(db: AsyncSession = Depends(get_db)) -> SubmitFeedbackUseCase:
    return SubmitFeedbackUseCase(report_repo=SqlAlchemyReportRepository(db))


def get_reprocess_report_use_case(db: AsyncSession = Depends(get_db)) -> ReprocessReportUseCase:
    return ReprocessReportUseCase(
        report_repo=SqlAlchemyReportRepository(db),
        execution_repo=SqlAlchemyExecutionRepository(db),
        column_config_repo=SqlAlchemyColumnConfigRepository(db),
        queue=_queue,
        project_repo=SqlAlchemyProjectRepository(db),
    )
