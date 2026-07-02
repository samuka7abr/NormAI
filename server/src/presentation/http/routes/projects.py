from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from application.projects.create_project import CreateProjectUseCase
from application.projects.delete_project import DeleteProjectUseCase
from application.projects.dtos import CreateProjectInput, ListProjectsInput, UpdateProjectInput
from application.projects.get_project import GetProjectUseCase
from application.projects.list_projects import ListProjectsUseCase
from application.projects.update_project import UpdateProjectUseCase
from domain.projects.exceptions import ProjectNameAlreadyExists, ProjectNotFound
from presentation.http.dependencies.auth import get_current_user_id
from presentation.http.dependencies.projects import (
    get_create_project_use_case,
    get_delete_project_use_case,
    get_get_project_use_case,
    get_list_projects_use_case,
    get_update_project_use_case,
)
from presentation.http.schemas.projects import (
    CreateProjectRequest,
    PaginatedProjectResponse,
    ProjectResponse,
    UpdateProjectRequest,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: CreateProjectRequest,
    user_id: UUID = Depends(get_current_user_id),
    use_case: CreateProjectUseCase = Depends(get_create_project_use_case),
) -> ProjectResponse:
    try:
        result = await use_case.execute(
            CreateProjectInput(
                user_id=user_id,
                name=body.name,
                description=body.description,
                ai_context=body.ai_context,
            )
        )
    except ProjectNameAlreadyExists as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return ProjectResponse(**result.__dict__)


@router.get("", response_model=PaginatedProjectResponse)
async def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: UUID = Depends(get_current_user_id),
    use_case: ListProjectsUseCase = Depends(get_list_projects_use_case),
) -> PaginatedProjectResponse:
    result = await use_case.execute(ListProjectsInput(user_id=user_id, page=page, page_size=page_size))
    return PaginatedProjectResponse(
        items=[ProjectResponse(**p.__dict__) for p in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: GetProjectUseCase = Depends(get_get_project_use_case),
) -> ProjectResponse:
    try:
        result = await use_case.execute(id=project_id, user_id=user_id)
    except ProjectNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return ProjectResponse(**result.__dict__)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: UpdateProjectRequest,
    user_id: UUID = Depends(get_current_user_id),
    use_case: UpdateProjectUseCase = Depends(get_update_project_use_case),
) -> ProjectResponse:
    try:
        result = await use_case.execute(
            UpdateProjectInput(
                id=project_id,
                user_id=user_id,
                name=body.name,
                description=body.description,
                ai_context=body.ai_context,
            )
        )
    except ProjectNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ProjectNameAlreadyExists as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return ProjectResponse(**result.__dict__)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: DeleteProjectUseCase = Depends(get_delete_project_use_case),
) -> None:
    try:
        await use_case.execute(id=project_id, user_id=user_id)
    except ProjectNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
