from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from domain.projects.entities import Project
from infrastructure.persistence.base import Base, TimestampMixin


class ProjectModel(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ai_context: Mapped[str] = mapped_column(Text, nullable=False, default="")

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_projects_user_name"),
        Index("idx_projects_user", "user_id"),
        Index("idx_projects_created_at", "created_at"),
    )

    def _to_entity(self) -> Project:
        return Project(
            id=self.id,
            user_id=self.user_id,
            name=self.name,
            description=self.description,
            ai_context=self.ai_context,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
