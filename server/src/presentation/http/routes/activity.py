from uuid import UUID

from fastapi import APIRouter, Depends, Query

from application.activity.list_activities import ListActivitiesUseCase
from presentation.http.dependencies.activity import get_list_activities_use_case
from presentation.http.dependencies.auth import get_current_user_id
from presentation.http.schemas.activity import ActivityListResponse, ActivityResponse

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=ActivityListResponse)
async def list_activities(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    user_id: UUID = Depends(get_current_user_id),
    use_case: ListActivitiesUseCase = Depends(get_list_activities_use_case),
) -> ActivityListResponse:
    result = await use_case.execute(user_id=user_id, limit=limit, offset=offset)
    return ActivityListResponse(
        items=[ActivityResponse(**item.__dict__) for item in result.items],
        total=result.total,
    )
