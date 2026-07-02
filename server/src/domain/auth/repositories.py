"""Contrato para persistência de refresh tokens."""
from typing import Protocol
from uuid import UUID

from domain.auth.entities import RefreshToken


class RefreshTokenRepository(Protocol):
    """Interface para repositório de refresh tokens; qualquer classe com esses métodos a satisfaz."""

    async def save(self, refresh_token: RefreshToken) -> None:
        """Cria ou atualiza um refresh token."""
        ...

    async def find_by_hash(self, token_hash: str) -> RefreshToken | None:
        """Busca um refresh token pelo seu hash. Retorna None se não existir."""
        ...

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        """Revoga todos os refresh tokens ativos de um usuário."""
        ...
