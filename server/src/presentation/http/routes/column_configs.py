from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.configure_columns import ConfigureColumnsUseCase
from application.projects.detect_columns import DetectColumnsUseCase
from application.projects.dtos import ColumnConfigInput, UpdateColumnConfigInput
from application.projects.update_column_config import UpdateColumnConfigUseCase
from domain.projects.exceptions import ColumnConfigNotFound, ProjectNotFound
from infrastructure.persistence.database import get_db
from presentation.http.dependencies.auth import get_current_user_id
from presentation.http.dependencies.projects import (
    get_configure_columns_use_case,
    get_detect_columns_use_case,
    get_update_column_config_use_case,
)
from presentation.http.schemas.column_configs import (
    ColumnConfigRequest,
    ColumnConfigResponse,
    DetectedColumnResponse,
    UpdateColumnConfigRequest,
)

router = APIRouter(prefix="/projects/{project_id}/columns", tags=["column-configs"])


@router.post(
    "/detect",
    response_model=list[DetectedColumnResponse],
    summary="Detecta colunas de uma planilha (não persiste)",
)
async def detect_columns(
    project_id: UUID,
    file: UploadFile = File(...),
    _user_id: UUID = Depends(get_current_user_id),
    use_case: DetectColumnsUseCase = Depends(get_detect_columns_use_case),
) -> list[DetectedColumnResponse]:
    content = await file.read()
    results = use_case.execute(content, file.filename or "upload.csv")
    return [DetectedColumnResponse(column_name=r.column_name, sample_values=r.sample_values) for r in results]


@router.put(
    "",
    response_model=list[ColumnConfigResponse],
    summary="Substitui todas as configs de colunas do projeto (idempotente)",
)
async def configure_columns(
    project_id: UUID,
    body: list[ColumnConfigRequest],
    user_id: UUID = Depends(get_current_user_id),
    use_case: ConfigureColumnsUseCase = Depends(get_configure_columns_use_case),
    db: AsyncSession = Depends(get_db),
) -> list[ColumnConfigResponse]:
    try:
        results = await use_case.execute(
            project_id=project_id,
            user_id=user_id,
            inputs=[
                ColumnConfigInput(
                    column_name=b.column_name,
                    enabled=b.enabled,
                    normalizations=b.normalizations,
                    classify=b.classify,
                    categories=b.categories,
                    sample_values=b.sample_values,
                )
                for b in body
            ],
        )
    except ProjectNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    await db.commit()
    return [ColumnConfigResponse(**r.__dict__) for r in results]


@router.get(
    "",
    response_model=list[ColumnConfigResponse],
    summary="Lista todas as configs de colunas do projeto",
)
async def list_column_configs(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: ConfigureColumnsUseCase = Depends(get_configure_columns_use_case),
) -> list[ColumnConfigResponse]:
    try:
        project = await use_case._project_repo.get_by_id(project_id, user_id)
        if project is None:
            raise ProjectNotFound(f"Project {project_id} not found")
        results = await use_case._column_repo.list_by_project(project_id)
    except ProjectNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return [ColumnConfigResponse(**c.__dict__) for c in results]


@router.patch(
    "/{column_id}",
    response_model=ColumnConfigResponse,
    summary="Edita pontualmente uma coluna",
)
async def update_column_config(
    project_id: UUID,
    column_id: UUID,
    body: UpdateColumnConfigRequest,
    user_id: UUID = Depends(get_current_user_id),
    use_case: UpdateColumnConfigUseCase = Depends(get_update_column_config_use_case),
) -> ColumnConfigResponse:
    try:
        result = await use_case.execute(
            UpdateColumnConfigInput(
                id=column_id,
                project_id=project_id,
                enabled=body.enabled,
                normalizations=body.normalizations,
                classify=body.classify,
                categories=body.categories,
            )
        )
    except ColumnConfigNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ColumnConfigResponse(**result.__dict__)
