from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from application.dictionary.create_entry import CreateDictionaryEntryUseCase
from application.dictionary.delete_entry import DeleteDictionaryEntryUseCase
from application.dictionary.dtos import (
    CreateDictionaryEntryInput,
    ListDictionaryEntriesInput,
    UpdateDictionaryEntryInput,
)
from application.dictionary.get_entry import GetDictionaryEntryUseCase
from application.dictionary.get_stats import GetDictionaryStatsUseCase
from application.dictionary.list_entries import ListDictionaryEntriesUseCase
from application.dictionary.update_entry import UpdateDictionaryEntryUseCase
from domain.dictionary.entities import DictionaryEntryKind
from domain.dictionary.exceptions import DictionaryEntryNameAlreadyExists, DictionaryEntryNotFound
from presentation.http.dependencies.auth import get_current_user_id
from presentation.http.dependencies.dictionary import (
    get_create_entry_use_case,
    get_delete_entry_use_case,
    get_get_entry_use_case,
    get_list_entries_use_case,
    get_stats_use_case,
    get_update_entry_use_case,
)
from presentation.http.schemas.dictionary import (
    CreateDictionaryEntryRequest,
    DictionaryEntryResponse,
    DictionaryStatsResponse,
    PaginatedDictionaryEntriesResponse,
    UpdateDictionaryEntryRequest,
)

# --- global dictionary (/dictionary) ---
router = APIRouter(prefix="/dictionary", tags=["dictionary"])

# --- project-scoped dictionary (/projects/{project_id}/dictionary) ---
project_dictionary_router = APIRouter(
    prefix="/projects/{project_id}/dictionary",
    tags=["dictionary"],
)


def _build_payload(kind: DictionaryEntryKind, body) -> dict:
    if kind == DictionaryEntryKind.categories:
        return {"items": body.items or []}
    elif kind == DictionaryEntryKind.context:
        return {"content": body.content or ""}
    elif kind == DictionaryEntryKind.mappings:
        return {"pairs": body.pairs or []}
    return {}


def _to_response(result) -> DictionaryEntryResponse:
    payload = result.payload or {}
    kind = result.kind
    return DictionaryEntryResponse(
        id=result.id,
        type=result.kind,
        title=result.name,
        description=result.description,
        used_in=result.used_in,
        updated_at=result.updated_at,
        items=payload.get("items") if kind == DictionaryEntryKind.categories else None,
        content=payload.get("content") if kind == DictionaryEntryKind.context else None,
        pairs=payload.get("pairs") if kind == DictionaryEntryKind.mappings else None,
    )


# ── Global routes ─────────────────────────────────────────────────────────────

@router.post("", response_model=DictionaryEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_global_entry(
    body: CreateDictionaryEntryRequest,
    user_id: UUID = Depends(get_current_user_id),
    use_case: CreateDictionaryEntryUseCase = Depends(get_create_entry_use_case),
) -> DictionaryEntryResponse:
    try:
        result = await use_case.execute(
            CreateDictionaryEntryInput(
                user_id=user_id,
                project_id=None,
                kind=body.kind,
                name=body.name,
                description=body.description,
                payload=_build_payload(body.kind, body),
            )
        )
    except DictionaryEntryNameAlreadyExists as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return _to_response(result)


@router.get("", response_model=PaginatedDictionaryEntriesResponse)
async def list_global_entries(
    kind: DictionaryEntryKind | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: UUID = Depends(get_current_user_id),
    use_case: ListDictionaryEntriesUseCase = Depends(get_list_entries_use_case),
) -> PaginatedDictionaryEntriesResponse:
    result = await use_case.execute(
        ListDictionaryEntriesInput(
            user_id=user_id,
            project_id=None,
            kind=kind,
            page=page,
            page_size=page_size,
            q=q,
        )
    )
    return PaginatedDictionaryEntriesResponse(
        items=[_to_response(e) for e in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


# IMPORTANT: register /stats before /{entry_id} so FastAPI doesn't treat "stats" as a UUID
@router.get("/stats", response_model=DictionaryStatsResponse)
async def get_global_stats(
    user_id: UUID = Depends(get_current_user_id),
    use_case: GetDictionaryStatsUseCase = Depends(get_stats_use_case),
) -> DictionaryStatsResponse:
    stats = await use_case.execute(user_id=user_id)
    return DictionaryStatsResponse(
        total=stats.total,
        by_type=stats.by_type,
        total_applications=stats.total_applications,
        unused_count=stats.unused_count,
        most_used=[
            {"id": m.id, "title": m.title, "type": m.type, "used_count": m.used_count}
            for m in stats.most_used
        ],
    )


@router.get("/{entry_id}", response_model=DictionaryEntryResponse)
async def get_entry(
    entry_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: GetDictionaryEntryUseCase = Depends(get_get_entry_use_case),
) -> DictionaryEntryResponse:
    try:
        result = await use_case.execute(id=entry_id, user_id=user_id)
    except DictionaryEntryNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return _to_response(result)


@router.patch("/{entry_id}", response_model=DictionaryEntryResponse)
async def update_entry(
    entry_id: UUID,
    body: UpdateDictionaryEntryRequest,
    user_id: UUID = Depends(get_current_user_id),
    use_case: UpdateDictionaryEntryUseCase = Depends(get_update_entry_use_case),
) -> DictionaryEntryResponse:
    try:
        result = await use_case.execute(
            UpdateDictionaryEntryInput(
                id=entry_id,
                user_id=user_id,
                name=body.name,
                description=body.description,
                payload=_build_payload_from_update(body),
            )
        )
    except DictionaryEntryNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DictionaryEntryNameAlreadyExists as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return _to_response(result)


def _build_payload_from_update(body: UpdateDictionaryEntryRequest) -> dict | None:
    """Return new payload only if any payload field was provided, else None (no update)."""
    if body.items is not None:
        return {"items": body.items}
    if body.content is not None:
        return {"content": body.content}
    if body.pairs is not None:
        return {"pairs": body.pairs}
    return None


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: DeleteDictionaryEntryUseCase = Depends(get_delete_entry_use_case),
) -> None:
    try:
        await use_case.execute(id=entry_id, user_id=user_id)
    except DictionaryEntryNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ── Project-scoped routes ──────────────────────────────────────────────────────

@project_dictionary_router.post("", response_model=DictionaryEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_project_entry(
    project_id: UUID,
    body: CreateDictionaryEntryRequest,
    user_id: UUID = Depends(get_current_user_id),
    use_case: CreateDictionaryEntryUseCase = Depends(get_create_entry_use_case),
) -> DictionaryEntryResponse:
    try:
        result = await use_case.execute(
            CreateDictionaryEntryInput(
                user_id=user_id,
                project_id=project_id,
                kind=body.kind,
                name=body.name,
                description=body.description,
                payload=_build_payload(body.kind, body),
            )
        )
    except DictionaryEntryNameAlreadyExists as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return _to_response(result)


@project_dictionary_router.get("", response_model=PaginatedDictionaryEntriesResponse)
async def list_project_entries(
    project_id: UUID,
    kind: DictionaryEntryKind | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: UUID = Depends(get_current_user_id),
    use_case: ListDictionaryEntriesUseCase = Depends(get_list_entries_use_case),
) -> PaginatedDictionaryEntriesResponse:
    result = await use_case.execute(
        ListDictionaryEntriesInput(
            user_id=user_id,
            project_id=project_id,
            kind=kind,
            page=page,
            page_size=page_size,
            q=q,
        )
    )
    return PaginatedDictionaryEntriesResponse(
        items=[_to_response(e) for e in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@project_dictionary_router.get("/{entry_id}", response_model=DictionaryEntryResponse)
async def get_project_entry(
    project_id: UUID,
    entry_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: GetDictionaryEntryUseCase = Depends(get_get_entry_use_case),
) -> DictionaryEntryResponse:
    try:
        result = await use_case.execute(id=entry_id, user_id=user_id)
    except DictionaryEntryNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return _to_response(result)


@project_dictionary_router.patch("/{entry_id}", response_model=DictionaryEntryResponse)
async def update_project_entry(
    project_id: UUID,
    entry_id: UUID,
    body: UpdateDictionaryEntryRequest,
    user_id: UUID = Depends(get_current_user_id),
    use_case: UpdateDictionaryEntryUseCase = Depends(get_update_entry_use_case),
) -> DictionaryEntryResponse:
    try:
        result = await use_case.execute(
            UpdateDictionaryEntryInput(
                id=entry_id,
                user_id=user_id,
                name=body.name,
                description=body.description,
                payload=_build_payload_from_update(body),
            )
        )
    except DictionaryEntryNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DictionaryEntryNameAlreadyExists as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return _to_response(result)


@project_dictionary_router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_entry(
    project_id: UUID,
    entry_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    use_case: DeleteDictionaryEntryUseCase = Depends(get_delete_entry_use_case),
) -> None:
    try:
        await use_case.execute(id=entry_id, user_id=user_id)
    except DictionaryEntryNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
