"""Caso de uso: atualização de nome/sobrenome do usuário autenticado."""
from application.users.dtos import UpdateProfileCommand, UserView
from domain.users.exceptions import UserNotFound
from domain.users.repositories import UserRepository


class UpdateProfileUseCase:
    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, cmd: UpdateProfileCommand) -> UserView:
        user = await self._user_repo.find_by_id(cmd.user_id)
        if user is None:
            raise UserNotFound("Usuário não encontrado.")

        if cmd.name is not None:
            user.name = cmd.name
        if cmd.last_name is not None:
            user.last_name = cmd.last_name

        await self._user_repo.save(user)

        return UserView(
            id=user.id,
            email=user.email,
            name=user.name,
            last_name=user.last_name,
            avatar_url=user.avatar_url,
        )
