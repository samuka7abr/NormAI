"""Converte exceções de domínio para HTTPException de forma centralizada, garantindo consistência entre rotas."""
from fastapi import HTTPException, status

from domain.auth.exceptions import (
    AuthDomainError,
    InvalidCredentials,
    InvalidToken,
    RefreshTokenExpired,
    RefreshTokenNotFound,
    RefreshTokenRevoked,
    TokenExpired,
)
from domain.users.exceptions import (
    EmailAlreadyExists,
    FileTooLarge,
    InvalidFileType,
    SamePassword,
    UserDomainError,
    UserNotFound,
    WeakPassword,
)


def domain_error_to_http(exc: Exception) -> HTTPException:
    """Mapeia exceções de domínio para o HTTPException correspondente com status code adequado."""
    if isinstance(exc, InvalidCredentials):
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if isinstance(exc, (InvalidToken, TokenExpired,
                        RefreshTokenNotFound, RefreshTokenRevoked,
                        RefreshTokenExpired)):
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    if isinstance(exc, EmailAlreadyExists):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )

    if isinstance(exc, UserNotFound):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if isinstance(exc, InvalidFileType):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    if isinstance(exc, FileTooLarge):
        return HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        )

    if isinstance(exc, (WeakPassword, SamePassword)):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    if isinstance(exc, (AuthDomainError, UserDomainError)):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    raise exc
