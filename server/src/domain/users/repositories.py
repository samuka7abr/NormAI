"""Contrato (interface) para persistência de usuários via typing.Protocol."""
from typing import Protocol
from uuid import UUID

from domain.users.entities import User


class UserRepository(Protocol):
    """Interface para repositório de usuários; qualquer classe com esses métodos a satisfaz."""

    async def save(self, user: User) -> None:
        """Cria ou atualiza um usuário."""
        ...

    async def find_by_id(self, user_id: UUID) -> User | None:
        """Busca um usuário pelo ID. Retorna None se não existir."""
        ...

    async def find_by_email(self, email: str) -> User | None:
        """Busca um usuário pelo email (case-insensitive). Retorna None se não existir."""
        ...

    async def exists_by_email(self, email: str) -> bool:
        """Verifica se já existe usuário com esse email."""
        ...

    async def update_avatar(self, user_id: UUID, avatar_url: str) -> None:
        """Atualiza a URL do avatar do usuário."""
        ...
