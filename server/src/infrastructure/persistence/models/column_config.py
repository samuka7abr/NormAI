from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from domain.projects.entities import ColumnConfig
from infrastructure.persistence.base import Base, TimestampMixin


class ColumnConfigModel(Base, TimestampMixin):
    __tablename__ = "column_configs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    column_name: Mapped[str] = mapped_column(String(200), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    normalizations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    classify: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    categories: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    sample_values: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    __table_args__ = (
        UniqueConstraint("project_id", "column_name", name="uq_column_configs_project_name"),
        Index("idx_column_configs_project", "project_id"),
    )

    def _to_entity(self) -> ColumnConfig:
        return ColumnConfig(
            id=self.id,
            project_id=self.project_id,
            column_name=self.column_name,
            enabled=self.enabled,
            normalizations=self.normalizations,
            classify=self.classify,
            categories=self.categories,
            sample_values=self.sample_values,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
