"""Caso de uso: logout."""
from domain.auth.repositories import RefreshTokenRepository

from application.auth.dtos import LogoutUserCommand
from application.auth.services import TokenService


class LogoutUserUseCase:
    """Revoga o refresh token do cookie se existir; ignora tokens inválidos para garantir idempotência."""

    def __init__(
        self,
        refresh_token_repo: RefreshTokenRepository,
        token_service: TokenService,
    ) -> None:
        self._refresh_token_repo = refresh_token_repo
        self._tokens = token_service

    async def execute(self, command: LogoutUserCommand) -> None:
        if not command.refresh_token:
            return

        token_hash = self._tokens.hash_refresh_token(command.refresh_token)
        stored = await self._refresh_token_repo.find_by_hash(token_hash)

        if stored is None or stored.is_revoked():
            return

        stored.revoke()
        await self._refresh_token_repo.save(stored)
