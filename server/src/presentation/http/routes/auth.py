"""Rotas HTTP de autenticação."""
from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from application.auth import (
    LoginUserCommand,
    LoginUserUseCase,
    LogoutUserCommand,
    LogoutUserUseCase,
    RefreshSessionCommand,
    RefreshSessionUseCase,
    RegisterUserCommand,
    RegisterUserUseCase,
)
from application.users import ResetForgottenPasswordCommand, ResetForgottenPasswordUseCase
from domain.auth.exceptions import RefreshTokenNotFound
from infrastructure.settings import Settings
from presentation.http.cookies import (
    REFRESH_TOKEN_COOKIE,
    clear_auth_cookies,
    set_access_cookie,
    set_refresh_cookie,
)
from infrastructure.persistence.database import get_db
from presentation.http.dependencies.container import (
    get_settings,
    provide_login_user,
    provide_logout_user,
    provide_refresh_session,
    provide_register_user,
    provide_reset_forgotten_password,
)
from presentation.http.error_handlers import domain_error_to_http
from presentation.http.schemas import (
    AuthenticatedResponse,
    LoginRequest,
    LogoutResponse,
    RegisterRequest,
    ResetForgottenPasswordRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user and start a session",
)
async def register(
    payload: RegisterRequest,
    response: Response,
    use_case: RegisterUserUseCase = Depends(provide_register_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Cria um novo usuário, gera tokens e define cookies de sessão."""
    try:
        session = await use_case.execute(
            RegisterUserCommand(
                email=payload.email,
                password=payload.password,
                name=payload.name,
                last_name=payload.last_name,
            )
        )
    except Exception as exc:
        raise domain_error_to_http(exc)

    await db.commit()

    set_access_cookie(
        response,
        token=session.access_token,
        max_age_seconds=session.access_token_expires_in,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
    set_refresh_cookie(
        response,
        token=session.refresh_token,
        max_age_seconds=session.refresh_token_expires_in,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )

    return UserResponse(id=str(session.user_id), email=session.user_email, name=session.user_name, last_name=session.user_last_name)


@router.post(
    "/login",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate existing user",
)
async def login(
    payload: LoginRequest,
    response: Response,
    use_case: LoginUserUseCase = Depends(provide_login_user),
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    """Autentica um usuário existente e define cookies de sessão."""
    try:
        session = await use_case.execute(
            LoginUserCommand(email=payload.email, password=payload.password)
        )
    except Exception as exc:
        raise domain_error_to_http(exc)

    set_access_cookie(
        response,
        token=session.access_token,
        max_age_seconds=session.access_token_expires_in,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
    set_refresh_cookie(
        response,
        token=session.refresh_token,
        max_age_seconds=session.refresh_token_expires_in,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )

    return UserResponse(id=str(session.user_id), email=session.user_email, name=session.user_name, last_name=session.user_last_name)


@router.post(
    "/refresh",
    response_model=AuthenticatedResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh access token using refresh cookie",
)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
    use_case: RefreshSessionUseCase = Depends(provide_refresh_session),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedResponse:
    """Renova o access token usando o refresh token do cookie (com rotação)."""
    if not refresh_token:
        raise domain_error_to_http(RefreshTokenNotFound("Refresh token missing."))

    try:
        session = await use_case.execute(
            RefreshSessionCommand(refresh_token=refresh_token)
        )
    except Exception as exc:
        raise domain_error_to_http(exc)

    set_access_cookie(
        response,
        token=session.access_token,
        max_age_seconds=session.access_token_expires_in,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
    set_refresh_cookie(
        response,
        token=session.refresh_token,
        max_age_seconds=session.refresh_token_expires_in,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )

    return AuthenticatedResponse(authenticated=True)


@router.post(
    "/logout",
    response_model=LogoutResponse,
    status_code=status.HTTP_200_OK,
    summary="End session and clear cookies",
)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
    use_case: LogoutUserUseCase = Depends(provide_logout_user),
) -> LogoutResponse:
    """Encerra a sessão: revoga refresh token e limpa cookies."""
    try:
        await use_case.execute(LogoutUserCommand(refresh_token=refresh_token))
    except Exception as exc:
        raise domain_error_to_http(exc)

    clear_auth_cookies(response)
    return LogoutResponse(authenticated=False)


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reset forgotten password using verified email",
)
async def reset_forgotten_password(
    payload: ResetForgottenPasswordRequest,
    use_case: ResetForgottenPasswordUseCase = Depends(provide_reset_forgotten_password),
) -> None:
    """Atualiza a senha de um usuário identificado pelo e-mail após verificação via OTP."""
    try:
        await use_case.execute(
            ResetForgottenPasswordCommand(
                email=payload.email,
                new_password=payload.new_password,
            )
        )
    except Exception as exc:
        raise domain_error_to_http(exc)