"""Entidade User do domínio; representa um usuário sem dependências técnicas como banco ou JWT."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

@dataclass
class User:
    """Usuário do sistema com email normalizado em lowercase e hash de senha."""
    email: str
    password_hash: str
    name: str
    last_name: str
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    avatar_url: str | None = None

    def __post_init__(self) -> None:
        self.email = self.email.strip().lower()

    def change_password(self, new_password_hash: str) -> None:
        self.password_hash = new_password_hash
        self.updated_at = datetime.now(timezone.utc)
