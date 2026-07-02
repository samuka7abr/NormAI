"""Caso de uso: obter o usuário atualmente autenticado."""
from uuid import UUID

from domain.users.exceptions import UserNotFound
from domain.users.repositories import UserRepository

from application.users.dtos import UserView


class GetCurrentUserUseCase:
    """Busca os dados do usuário pelo ID extraído do JWT validado na camada de apresentação."""

    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, user_id: UUID) -> UserView:
        user = await self._user_repo.find_by_id(user_id)
        if user is None:
            raise UserNotFound("User not found.")

        return UserView(id=user.id, email=user.email, name=user.name, last_name=user.last_name)
