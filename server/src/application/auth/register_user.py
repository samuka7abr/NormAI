"""Caso de uso: registrar um novo usuário."""
from domain.auth.repositories import RefreshTokenRepository
from domain.users.entities import User
from domain.users.exceptions import EmailAlreadyExists, WeakPassword
from domain.users.repositories import UserRepository

from application.auth.dtos import AuthenticatedSession, RegisterUserCommand
from application.auth.services import PasswordHasher, TokenService

MIN_PASSWORD_LENGTH = 8


class RegisterUserUseCase:
    """Registra novo usuário com validação de email único e senha mínima, retornando sessão autenticada."""

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

    async def execute(self, command: RegisterUserCommand) -> AuthenticatedSession:
        if await self._user_repo.exists_by_email(command.email):
            raise EmailAlreadyExists(f"Email already registered.")

        if len(command.password) < MIN_PASSWORD_LENGTH:
            raise WeakPassword(
                f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
            )

        password_hash = self._hasher.hash(command.password)

        user = User(email=command.email, password_hash=password_hash, name=command.name, last_name=command.last_name)
        await self._user_repo.save(user)

        access = self._tokens.issue_access_token(user.id)
        refresh_pair = self._tokens.issue_refresh_token(user.id)

        from datetime import datetime, timedelta, timezone
        from domain.auth.entities import RefreshToken
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
