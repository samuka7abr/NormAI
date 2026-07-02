"""Helpers para setar e limpar os cookies de autenticação de forma centralizada."""
from fastapi import Response

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


def set_access_cookie(
    response: Response,
    token: str,
    max_age_seconds: int,
    secure: bool,
    samesite: str,
) -> None:
    """Define o cookie do access token."""
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        secure=secure,
        samesite=samesite,  # type: ignore[arg-type]
        path="/",
    )


def set_refresh_cookie(
    response: Response,
    token: str,
    max_age_seconds: int,
    secure: bool,
    samesite: str,
) -> None:
    """Define o cookie do refresh token."""
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        secure=secure,
        samesite=samesite,  # type: ignore[arg-type]
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """Limpa ambos os cookies de auth (usado em logout e troca de senha)."""
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/")
