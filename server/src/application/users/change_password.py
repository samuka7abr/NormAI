"""Caso de uso: trocar a senha do usuário autenticado."""
from domain.auth.repositories import RefreshTokenRepository
from domain.users.exceptions import (
    SamePassword,
    UserNotFound,
    WeakPassword,
)
from domain.users.repositories import UserRepository
from domain.auth.exceptions import InvalidCredentials

from application.auth.services import PasswordHasher
from application.users.dtos import ChangePasswordCommand

MIN_PASSWORD_LENGTH = 8


class ChangePasswordUseCase:
    """Valida e troca a senha do usuário autenticado, revogando todos os refresh tokens para forçar re-login."""

    def __init__(
        self,
        user_repo: UserRepository,
        refresh_token_repo: RefreshTokenRepository,
        password_hasher: PasswordHasher,
    ) -> None:
        self._user_repo = user_repo
        self._refresh_token_repo = refresh_token_repo
        self._hasher = password_hasher

    async def execute(self, command: ChangePasswordCommand) -> None:
        user = await self._user_repo.find_by_id(command.user_id)
        if user is None:
            raise UserNotFound("User not found.")

        if not self._hasher.verify(command.current_password, user.password_hash):
            raise InvalidCredentials("Current password is incorrect.")

        if len(command.new_password) < MIN_PASSWORD_LENGTH:
            raise WeakPassword(
                f"New password must be at least {MIN_PASSWORD_LENGTH} characters."
            )

        if self._hasher.verify(command.new_password, user.password_hash):
            raise SamePassword("New password must be different from the current one.")

        new_hash = self._hasher.hash(command.new_password)
        user.change_password(new_hash)
        await self._user_repo.save(user)

        await self._refresh_token_repo.revoke_all_for_user(user.id)
