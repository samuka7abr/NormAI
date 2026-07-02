from uuid import UUID

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from domain.users.entities import User
from infrastructure.persistence.base import Base, TimestampMixin


class UserModel(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, server_default="")
    last_name: Mapped[str] = mapped_column(String(120), nullable=False, server_default="")
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    def _to_entity(self) -> User:
        return User(
            id=self.id,
            email=self.email,
            password_hash=self.password_hash,
            name=self.name,
            last_name=self.last_name,
            created_at=self.created_at,
            updated_at=self.updated_at,
            avatar_url=self.avatar_url,
        )
