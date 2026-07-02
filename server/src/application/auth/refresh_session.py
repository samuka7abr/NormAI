"""Caso de uso: renovar sessão usando refresh token (com rotação)."""
from datetime import datetime, timedelta, timezone

from domain.auth.entities import RefreshToken
from domain.auth.exceptions import (
    RefreshTokenExpired,
    RefreshTokenNotFound,
    RefreshTokenRevoked,
)
from domain.auth.repositories import RefreshTokenRepository
from domain.users.exceptions import UserNotFound
from domain.users.repositories import UserRepository

from application.auth.dtos import AuthenticatedSession, RefreshSessionCommand
from application.auth.services import TokenService


class RefreshSessionUseCase:
    """Valida o refresh token, revoga-o e emite novos tokens (rotação), impedindo reuso após comprometimento."""

    def __init__(
        self,
        user_repo: UserRepository,
        refresh_token_repo: RefreshTokenRepository,
        token_service: TokenService,
    ) -> None:
        self._user_repo = user_repo
        self._refresh_token_repo = refresh_token_repo
        self._tokens = token_service

    async def execute(self, command: RefreshSessionCommand) -> AuthenticatedSession:
        token_hash = self._tokens.hash_refresh_token(command.refresh_token)

        stored = await self._refresh_token_repo.find_by_hash(token_hash)
        if stored is None:
            raise RefreshTokenNotFound("Refresh token not found.")

        if stored.is_revoked():
            raise RefreshTokenRevoked("Refresh token was revoked.")

        if stored.is_expired():
            raise RefreshTokenExpired("Refresh token expired.")

        user = await self._user_repo.find_by_id(stored.user_id)
        if user is None:
            raise UserNotFound("User of refresh token not found.")

        stored.revoke()
        await self._refresh_token_repo.save(stored)

        access = self._tokens.issue_access_token(user.id)
        new_refresh = self._tokens.issue_refresh_token(user.id)

        new_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=new_refresh.expires_in_seconds
        )
        await self._refresh_token_repo.save(
            RefreshToken(
                user_id=user.id,
                token_hash=new_refresh.token_hash,
                expires_at=new_expires_at,
            )
        )

        return AuthenticatedSession(
            user_id=user.id,
            user_email=user.email,
            user_name=user.name,
            user_last_name=user.last_name,
            access_token=access.value,
            access_token_expires_in=access.expires_in_seconds,
            refresh_token=new_refresh.plain_value,
            refresh_token_expires_in=new_refresh.expires_in_seconds,
        )
