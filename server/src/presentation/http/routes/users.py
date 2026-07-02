"""Rotas HTTP de usuário."""
from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from application.users import (
    ChangePasswordCommand,
    ChangePasswordUseCase,
    GetCurrentUserUseCase,
    UpdateProfileCommand,
    UpdateProfileUseCase,
    UploadAvatarCommand,
    UploadAvatarUseCase,
)
from presentation.http.cookies import clear_auth_cookies
from presentation.http.dependencies.auth import get_current_user_id
from presentation.http.dependencies.container import (
    provide_change_password,
    provide_get_current_user,
    provide_update_profile,
    provide_upload_avatar,
)
from presentation.http.error_handlers import domain_error_to_http
from presentation.http.schemas import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    UpdateProfileRequest,
    UploadAvatarResponse,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user",
)
async def get_me(
    current_user_id: UUID = Depends(get_current_user_id),
    use_case: GetCurrentUserUseCase = Depends(provide_get_current_user),
) -> UserResponse:
    """Retorna dados do usuário autenticado (via cookie access_token)."""
    try:
        user = await use_case.execute(current_user_id)
    except Exception as exc:
        raise domain_error_to_http(exc)

    return UserResponse(id=str(user.id), email=user.email, name=user.name, last_name=user.last_name, avatar_url=user.avatar_url)


@router.patch(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    use_case: UpdateProfileUseCase = Depends(provide_update_profile),
) -> UserResponse:
    """Atualiza nome e/ou sobrenome do usuário autenticado."""
    try:
        user = await use_case.execute(
            UpdateProfileCommand(
                user_id=current_user_id,
                name=payload.name,
                last_name=payload.last_name,
            )
        )
    except Exception as exc:
        raise domain_error_to_http(exc)

    return UserResponse(id=str(user.id), email=user.email, name=user.name, last_name=user.last_name, avatar_url=user.avatar_url)


@router.patch(
    "/me/password",
    response_model=ChangePasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Change current user password",
)
async def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    current_user_id: UUID = Depends(get_current_user_id),
    use_case: ChangePasswordUseCase = Depends(provide_change_password),
) -> ChangePasswordResponse:
    """Altera a senha do usuário autenticado, revoga os refresh tokens e limpa os cookies forçando re-login."""
    try:
        await use_case.execute(
            ChangePasswordCommand(
                user_id=current_user_id,
                current_password=payload.current_password,
                new_password=payload.new_password,
            )
        )
    except Exception as exc:
        raise domain_error_to_http(exc)

    clear_auth_cookies(response)

    return ChangePasswordResponse(password_updated=True)


@router.patch(
    "/me/avatar",
    response_model=UploadAvatarResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload avatar do usuário autenticado",
)
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user_id: UUID = Depends(get_current_user_id),
    use_case: UploadAvatarUseCase = Depends(provide_upload_avatar),
) -> UploadAvatarResponse:
    """Recebe uma imagem (JPG, JPEG, PNG ou WebP, máx 5 MB) e atualiza o avatar do usuário."""
    file_data = await avatar.read()
    try:
        result = await use_case.execute(
            UploadAvatarCommand(
                user_id=current_user_id,
                file_data=file_data,
                content_type=avatar.content_type or "application/octet-stream",
            )
        )
    except Exception as exc:
        raise domain_error_to_http(exc)

    return UploadAvatarResponse(avatar_url=result.avatar_url)
