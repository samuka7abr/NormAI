"""Entidade RefreshToken do domínio; armazena apenas o hash do token, nunca o valor em texto puro."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


@dataclass
class RefreshToken:
    """Refresh token persistido identificado por hash, com suporte a verificação de revogação e expiração."""
    user_id: UUID
    token_hash: str
    expires_at: datetime
    id: UUID = field(default_factory=uuid4)
    revoked_at: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_revoked(self) -> bool:
        """Token foi revogado manualmente?"""
        return self.revoked_at is not None

    def is_expired(self) -> bool:
        """Token passou da data de expiração?"""
        return datetime.now(timezone.utc) >= self.expires_at

    def is_active(self) -> bool:
        """Token pode ser usado para renovar sessão?"""
        return not self.is_revoked() and not self.is_expired()

    def revoke(self) -> None:
        """Marca o token como revogado agora."""
        if self.revoked_at is None:
            self.revoked_at = datetime.now(timezone.utc)
