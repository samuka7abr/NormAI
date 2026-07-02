"""Caso de uso: resetar a senha de um usuário que a esqueceu (sem autenticação)."""
from domain.auth.repositories import RefreshTokenRepository
from domain.users.exceptions import UserNotFound, WeakPassword
from domain.users.repositories import UserRepository

from application.auth.services import PasswordHasher
from application.users.dtos import ResetForgottenPasswordCommand

MIN_PASSWORD_LENGTH = 8


class ResetForgottenPasswordUseCase:
    """Atualiza a senha de um usuário identificado pelo e-mail, revogando todos os refresh tokens."""

    def __init__(
        self,
        user_repo: UserRepository,
        refresh_token_repo: RefreshTokenRepository,
        password_hasher: PasswordHasher,
    ) -> None:
        self._user_repo = user_repo
        self._refresh_token_repo = refresh_token_repo
        self._hasher = password_hasher

    async def execute(self, command: ResetForgottenPasswordCommand) -> None:
        user = await self._user_repo.find_by_email(command.email)
        if user is None:
            raise UserNotFound("User not found.")

        if len(command.new_password) < MIN_PASSWORD_LENGTH:
            raise WeakPassword(
                f"New password must be at least {MIN_PASSWORD_LENGTH} characters."
            )

        new_hash = self._hasher.hash(command.new_password)
        user.change_password(new_hash)
        await self._user_repo.save(user)

        await self._refresh_token_repo.revoke_all_for_user(user.id)
