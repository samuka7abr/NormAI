"""Contratos (interfaces) para serviços técnicos usados pelos casos de uso de auth."""
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


class PasswordHasher(Protocol):
    """Contrato para qualquer implementação de hash de senha."""

    def hash(self, password: str) -> str:
        """Gera o hash de uma senha em texto puro."""
        ...

    def verify(self, password: str, hashed: str) -> bool:
        """Verifica se uma senha em texto puro corresponde a um hash."""
        ...


@dataclass(frozen=True)
class AccessToken:
    """Resultado da emissão de um access token."""
    value: str
    expires_in_seconds: int


@dataclass(frozen=True)
class RefreshTokenPair:
    """Contém o token em texto puro (para o cookie) e o hash (para o banco); o texto puro só existe nesse momento."""
    plain_value: str
    token_hash: str
    expires_in_seconds: int


class TokenService(Protocol):
    """Contrato para geração e validação de tokens (JWT + refresh)."""

    def issue_access_token(self, user_id: UUID) -> AccessToken:
        """Gera um novo access token JWT para o usuário."""
        ...

    def decode_access_token(self, token: str) -> UUID:
        """Decodifica o access token e retorna o user_id, lançando TokenExpired ou InvalidToken em caso de erro."""
        ...

    def issue_refresh_token(self, user_id: UUID) -> RefreshTokenPair:
        """Gera um novo refresh token retornando texto puro, hash e expiração."""
        ...

    def hash_refresh_token(self, plain_value: str) -> str:
        """Gera o hash SHA-256 de um refresh token em texto puro para busca no banco."""
        ...
