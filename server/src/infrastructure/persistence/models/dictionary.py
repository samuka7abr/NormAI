from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from domain.dictionary.entities import DictionaryEntry, DictionaryEntryKind
from infrastructure.persistence.base import Base, TimestampMixin


class DictionaryEntryModel(Base, TimestampMixin):
    __tablename__ = "dictionary_entries"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        Index("idx_dictionary_user", "user_id"),
        Index(
            "idx_dictionary_project",
            "project_id",
            postgresql_where=text("project_id IS NOT NULL"),
        ),
        Index(
            "uq_dictionary_global",
            "user_id", "kind", "name",
            unique=True,
            postgresql_where=text("project_id IS NULL"),
        ),
        Index(
            "uq_dictionary_project",
            "project_id", "kind", "name",
            unique=True,
            postgresql_where=text("project_id IS NOT NULL"),
        ),
    )

    def _to_entity(self) -> DictionaryEntry:
        return DictionaryEntry(
            id=self.id,
            user_id=self.user_id,
            project_id=self.project_id,
            kind=DictionaryEntryKind(self.kind),
            name=self.name,
            description=self.description,
            payload=self.payload,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class DictionaryApplicationModel(Base):
    __tablename__ = "dictionary_applications"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    entry_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("dictionary_entries.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    column_name: Mapped[str] = mapped_column(String(80), nullable=False)
    applied_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("entry_id", "project_id", "column_name", name="uq_dict_application"),
    )
