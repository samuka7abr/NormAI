"""Caso de uso: login de usuário existente."""
from datetime import datetime, timedelta, timezone

from domain.auth.entities import RefreshToken
from domain.auth.exceptions import InvalidCredentials
from domain.auth.repositories import RefreshTokenRepository
from domain.users.repositories import UserRepository

from application.auth.dtos import AuthenticatedSession, LoginUserCommand
from application.auth.services import PasswordHasher, TokenService


class LoginUserUseCase:
    """Autentica usuário verificando credenciais com mensagem genérica em caso de falha (segurança)."""

    def __init__(
        self,
        user_repo: UserRepository,
        refresh_token_repo: RefreshTokenRepository,
        password_hasher: PasswordHasher,
        token_service: TokenService,
    ) -> None:
        self._user_repo = user_repo
        self._refresh_token_repo = refresh_token_repo
        self._hasher = password_hasher
        self._tokens = token_service

    async def execute(self, command: LoginUserCommand) -> AuthenticatedSession:
        user = await self._user_repo.find_by_email(command.email)

        if user is None:
            raise InvalidCredentials("Invalid email or password.")
        if not self._hasher.verify(command.password, user.password_hash):
            raise InvalidCredentials("Invalid email or password.")

        access = self._tokens.issue_access_token(user.id)
        refresh_pair = self._tokens.issue_refresh_token(user.id)

        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=refresh_pair.expires_in_seconds
        )
        await self._refresh_token_repo.save(
            RefreshToken(
                user_id=user.id,
                token_hash=refresh_pair.token_hash,
                expires_at=expires_at,
            )
        )

        return AuthenticatedSession(
            user_id=user.id,
            user_email=user.email,
            user_name=user.name,
            user_last_name=user.last_name,
            access_token=access.value,
            access_token_expires_in=access.expires_in_seconds,
            refresh_token=refresh_pair.plain_value,
            refresh_token_expires_in=refresh_pair.expires_in_seconds,
        )
