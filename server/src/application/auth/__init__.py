"""Casos de uso de autenticação."""
from application.auth.dtos import (
    AuthenticatedSession,
    LoginUserCommand,
    LogoutUserCommand,
    RefreshSessionCommand,
    RegisterUserCommand,
)
from application.auth.login_user import LoginUserUseCase
from application.auth.logout_user import LogoutUserUseCase
from application.auth.refresh_session import RefreshSessionUseCase
from application.auth.register_user import RegisterUserUseCase
from application.auth.services import (
    AccessToken,
    PasswordHasher,
    RefreshTokenPair,
    TokenService,
)

__all__ = [
    # Use cases
    "RegisterUserUseCase",
    "LoginUserUseCase",
    "RefreshSessionUseCase",
    "LogoutUserUseCase",
    # DTOs
    "RegisterUserCommand",
    "LoginUserCommand",
    "RefreshSessionCommand",
    "LogoutUserCommand",
    "AuthenticatedSession",
    # Services
    "PasswordHasher",
    "TokenService",
    "AccessToken",
    "RefreshTokenPair",
]