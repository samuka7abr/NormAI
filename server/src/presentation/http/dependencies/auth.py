"""Dependência FastAPI para extrair e validar o user_id do cookie access_token, retornando 401 em caso de falha."""
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status

from application.auth.services import TokenService
from domain.auth.exceptions import InvalidToken, TokenExpired
from presentation.http.cookies import ACCESS_TOKEN_COOKIE
from presentation.http.dependencies.container import get_token_service


async def get_current_user_id(
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
    token_service: TokenService = Depends(get_token_service),
) -> UUID:
    """Extrai o user_id do cookie access_token, lançando 401 se ausente, inválido ou expirado."""
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    try:
        return token_service.decode_access_token(access_token)
    except (InvalidToken, TokenExpired):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )
