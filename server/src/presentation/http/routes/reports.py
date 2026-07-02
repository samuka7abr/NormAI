from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from application.reports.download_result import DownloadResultUseCase
from application.reports.get_execution_status import GetExecutionStatusUseCase
from application.reports.get_report import GetReportUseCase
from application.reports.list_reports import ListReportsUseCase
from application.reports.reprocess_report import ReprocessReportUseCase
from application.reports.submit_feedback import SubmitFeedbackUseCase
from application.reports.upload_report import UploadReportUseCase
from application.reports.dtos import ListReportsInput, SubmitFeedbackInput, UploadReportInput
from domain.projects.exceptions import ProjectNotFound
from domain.reports.exceptions import (
    ColumnsMismatch,
    InvalidApprovalTransition,
    ReportNotFound,
    ReportNotReady,
)
from presentation.http.dependencies.auth import get_current_user_id
from presentation.http.dependencies.reports import (
    get_download_result_use_case,
    get_execution_status_use_case,
    get_get_report_use_case,
    get_list_reports_use_case,
    get_reprocess_report_use_case,
    get_submit_feedback_use_case,
    get_upload_report_use_case,
)
from presentation.http.schemas.reports import (
    ExecutionStatusResponse,
    PaginatedReportsResponse,
    ReportDetailResponse,
    ReportListItemResponse,
    ReportResponse,
    SubmitFeedbackRequest,
    UploadReportResponse,
)

router = APIRouter(tags=["reports"])


@router.post(
    "/projects/{project_id}/reports",
    response_model=UploadReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Faz upload de um relatório (CSV ou XLSX)",
)
async def upload_report(
    project_id: UUID,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id),
    use_case: UploadReportUseCase = Depends(get_upload_report_use_case),
) -> UploadReportResponse:
    content = await file.read()
    try:
        result = await use_case.execute(
            UploadReportInput(
                project_id=project_id,
                user_id=user_id,
                filename=file.filename or "upload.csv",
                content=content,
            )
        )
    except ProjectNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ColumnsMismatch as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"missing_columns": e.missing, "extra_columns": e.extra},
        )
    return UploadReportResponse(
        report_id=result.report.id,
        execution_id=result.execution_id,
        original_filename=result.report.original_filename,
        approval_status=result.report.approval_status,
        extra_columns=result.extra_columns,
    )


@router.get(
    "/projects/{project_id}/reports",
    response_model=PaginatedReportsResponse,
    summary="Lista relatórios do projeto",
)
async def list_reports(
    project_id: UUID,
    page: int = 1,
    page_size: int = 20,
    user_id: UUID = Depends(get_current_user_id),
    use_case: ListReportsUseCase = Depends(get_list_reports_use_case),
) -> PaginatedReportsResponse:
    try:
        result = await use_case.execute(
            ListReportsInput(project_id=project_id, user_id=user_id, page=page, page_size=page_size)
        )
    except ProjectNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return PaginatedReportsResponse(
        items=[ReportListItemResponse(**r.__dict__) for r in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.get(
    "/reports/{report_id}",
    response_model=ReportDetailResponse,
    summary="Busca relatório com todas as execuções",
)
async def get_report(
    report_id: UUID,
    project_id: UUID,
    _user_id: UUID = Depends(get_current_user_id),
    use_case: GetReportUseCase = Depends(get_get_report_use_case),
) -> ReportDetailResponse:
    try:
        result = await use_case.execute(report_id=report_id, project_id=project_id)
    except ReportNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ReportDetailResponse(
        report=ReportResponse(**result.report.__dict__),
        executions=[ExecutionStatusResponse(**e.__dict__) for e in result.executions],
    )


@router.get(
    "/reports/{report_id}/executions/{execution_id}/status",
    response_model=ExecutionStatusResponse,
    summary="Polling de status de uma execução",
)
async def get_execution_status(
    report_id: UUID,
    execution_id: UUID,
    project_id: UUID,
    _user_id: UUID = Depends(get_current_user_id),
    use_case: GetExecutionStatusUseCase = Depends(get_execution_status_use_case),
) -> ExecutionStatusResponse:
    try:
        result = await use_case.execute(
            report_id=report_id, execution_id=execution_id, project_id=project_id
        )
    except ReportNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ExecutionStatusResponse(**result.__dict__)


@router.get(
    "/reports/{report_id}/executions/{execution_id}/download",
    summary="Download do resultado de uma execução (presigned URL)",
)
async def download_result(
    report_id: UUID,
    execution_id: UUID,
    project_id: UUID,
    stream: bool = False,
    _user_id: UUID = Depends(get_current_user_id),
    use_case: DownloadResultUseCase = Depends(get_download_result_use_case),
):
    try:
        if stream:
            body = await use_case.get_stream(
                report_id=report_id, execution_id=execution_id, project_id=project_id
            )
            return StreamingResponse(
                body,
                media_type="application/octet-stream",
                headers={"Content-Disposition": 'attachment; filename="resultado_processado"'},
            )

        url = await use_case.get_presigned_url(
            report_id=report_id, execution_id=execution_id, project_id=project_id
        )
    except ReportNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ReportNotReady as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return {"download_url": url}


@router.post(
    "/reports/{report_id}/reprocess",
    response_model=ExecutionStatusResponse,
    summary="Cria nova execução reaproveitando o arquivo original",
)
async def reprocess_report(
    report_id: UUID,
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: ReprocessReportUseCase = Depends(get_reprocess_report_use_case),
) -> ExecutionStatusResponse:
    try:
        result = await use_case.execute(
            report_id=report_id, project_id=project_id, user_id=user_id
        )
    except ReportNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ExecutionStatusResponse(**result.__dict__)


@router.patch(
    "/reports/{report_id}/feedback",
    response_model=ReportResponse,
    summary="Aprova ou rejeita um relatório",
)
async def submit_feedback(
    report_id: UUID,
    project_id: UUID,
    body: SubmitFeedbackRequest,
    _user_id: UUID = Depends(get_current_user_id),
    use_case: SubmitFeedbackUseCase = Depends(get_submit_feedback_use_case),
) -> ReportResponse:
    try:
        result = await use_case.execute(
            SubmitFeedbackInput(
                report_id=report_id,
                project_id=project_id,
                user_id=_user_id,
                approval_status=body.approval_status,
                approval_reason=body.approval_reason,
            )
        )
    except ReportNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InvalidApprovalTransition as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return ReportResponse(**result.__dict__)
