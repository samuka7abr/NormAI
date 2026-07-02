from uuid import UUID

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from domain.dictionary.entities import (
    DictionaryEntry,
    DictionaryEntryKind,
    DictionaryMostUsed,
    DictionaryStats,
)
from domain.dictionary.exceptions import DictionaryEntryNameAlreadyExists
from domain.dictionary.repositories import DictionaryEntryRepository
from infrastructure.persistence.models import DictionaryApplicationModel, DictionaryEntryModel, ProjectModel, UserModel  # noqa: F401


class SqlAlchemyDictionaryEntryRepository(DictionaryEntryRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, entry: DictionaryEntry) -> DictionaryEntry:
        model = DictionaryEntryModel(
            id=entry.id,
            user_id=entry.user_id,
            project_id=entry.project_id,
            kind=entry.kind.value,
            name=entry.name,
            description=entry.description,
            payload=entry.payload,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )
        self._session.add(model)
        try:
            await self._session.flush()
        except IntegrityError:
            await self._session.rollback()
            raise DictionaryEntryNameAlreadyExists(
                f"Entry '{entry.name}' of kind '{entry.kind}' already exists"
            )
        return model._to_entity()

    async def get_by_id(self, id: UUID, user_id: UUID) -> DictionaryEntry | None:
        stmt = select(DictionaryEntryModel).where(
            DictionaryEntryModel.id == id,
            DictionaryEntryModel.user_id == user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return model._to_entity() if model else None

    async def list_global(
        self,
        user_id: UUID,
        kind: DictionaryEntryKind | None,
        offset: int,
        limit: int,
        q: str | None = None,
    ) -> tuple[list[DictionaryEntry], int]:
        used_in_subq = (
            select(func.array_agg(DictionaryApplicationModel.project_id.distinct()))
            .where(DictionaryApplicationModel.entry_id == DictionaryEntryModel.id)
            .correlate(DictionaryEntryModel)
            .scalar_subquery()
        )

        stmt = select(
            DictionaryEntryModel,
            func.count(DictionaryEntryModel.id).over().label("total"),
            used_in_subq.label("used_in"),
        ).where(
            DictionaryEntryModel.user_id == user_id,
            DictionaryEntryModel.project_id.is_(None),
        )
        if kind is not None:
            stmt = stmt.where(DictionaryEntryModel.kind == kind.value)
        if q is not None:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(
                    DictionaryEntryModel.name.ilike(pattern),
                    DictionaryEntryModel.description.ilike(pattern),
                    cast(DictionaryEntryModel.payload, String).ilike(pattern),
                )
            )
        stmt = stmt.order_by(DictionaryEntryModel.created_at.desc()).offset(offset).limit(limit)

        rows = (await self._session.execute(stmt)).all()
        if not rows:
            return [], 0
        entries = []
        for r in rows:
            entity = r.DictionaryEntryModel._to_entity()
            entity.used_in = [uid for uid in (r.used_in or []) if uid is not None]
            entries.append(entity)
        return entries, rows[0].total

    async def list_by_project(
        self,
        project_id: UUID,
        user_id: UUID,
        kind: DictionaryEntryKind | None,
        offset: int,
        limit: int,
        q: str | None = None,
    ) -> tuple[list[DictionaryEntry], int]:
        used_in_subq = (
            select(func.array_agg(DictionaryApplicationModel.project_id.distinct()))
            .where(DictionaryApplicationModel.entry_id == DictionaryEntryModel.id)
            .correlate(DictionaryEntryModel)
            .scalar_subquery()
        )

        stmt = select(
            DictionaryEntryModel,
            func.count(DictionaryEntryModel.id).over().label("total"),
            used_in_subq.label("used_in"),
        ).where(
            DictionaryEntryModel.project_id == project_id,
            DictionaryEntryModel.user_id == user_id,
        )
        if kind is not None:
            stmt = stmt.where(DictionaryEntryModel.kind == kind.value)
        if q is not None:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(
                    DictionaryEntryModel.name.ilike(pattern),
                    DictionaryEntryModel.description.ilike(pattern),
                    cast(DictionaryEntryModel.payload, String).ilike(pattern),
                )
            )
        stmt = stmt.order_by(DictionaryEntryModel.created_at.desc()).offset(offset).limit(limit)

        rows = (await self._session.execute(stmt)).all()
        if not rows:
            return [], 0
        entries = []
        for r in rows:
            entity = r.DictionaryEntryModel._to_entity()
            entity.used_in = [uid for uid in (r.used_in or []) if uid is not None]
            entries.append(entity)
        return entries, rows[0].total

    async def list_merged(
        self,
        user_id: UUID,
        project_id: UUID,
        kind: DictionaryEntryKind | None,
    ) -> list[DictionaryEntry]:
        stmt = select(DictionaryEntryModel).where(
            DictionaryEntryModel.user_id == user_id,
            (DictionaryEntryModel.project_id == project_id)
            | DictionaryEntryModel.project_id.is_(None),
        )
        if kind is not None:
            stmt = stmt.where(DictionaryEntryModel.kind == kind.value)

        rows = (await self._session.execute(stmt)).scalars().all()
        entries = [r._to_entity() for r in rows]

        # project entries override global ones with the same (kind, name)
        project_keys = {(e.kind, e.name) for e in entries if e.project_id is not None}
        return [
            e for e in entries
            if e.project_id is not None or (e.kind, e.name) not in project_keys
        ]

    async def update(self, entry: DictionaryEntry) -> DictionaryEntry:
        stmt = select(DictionaryEntryModel).where(
            DictionaryEntryModel.id == entry.id,
            DictionaryEntryModel.user_id == entry.user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        model.name = entry.name
        model.description = entry.description
        model.payload = entry.payload
        model.updated_at = entry.updated_at
        try:
            await self._session.flush()
        except IntegrityError:
            await self._session.rollback()
            raise DictionaryEntryNameAlreadyExists(
                f"Entry '{entry.name}' of kind '{entry.kind}' already exists"
            )
        return model._to_entity()

    async def delete(self, id: UUID, user_id: UUID) -> None:
        stmt = select(DictionaryEntryModel).where(
            DictionaryEntryModel.id == id,
            DictionaryEntryModel.user_id == user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        await self._session.delete(model)
        await self._session.flush()

    async def get_stats(self, user_id: UUID) -> DictionaryStats:
        # Count by kind (global entries only)
        kind_stmt = (
            select(DictionaryEntryModel.kind, func.count().label("cnt"))
            .where(
                DictionaryEntryModel.user_id == user_id,
                DictionaryEntryModel.project_id.is_(None),
            )
            .group_by(DictionaryEntryModel.kind)
        )
        kind_rows = (await self._session.execute(kind_stmt)).all()
        by_type = {row.kind: row.cnt for row in kind_rows}
        total = sum(by_type.values())

        # Total applications for this user's global entries
        total_apps_stmt = (
            select(func.count())
            .select_from(DictionaryApplicationModel)
            .join(DictionaryEntryModel, DictionaryApplicationModel.entry_id == DictionaryEntryModel.id)
            .where(
                DictionaryEntryModel.user_id == user_id,
                DictionaryEntryModel.project_id.is_(None),
            )
        )
        total_applications = (await self._session.execute(total_apps_stmt)).scalar() or 0

        # Unused entries (no applications)
        used_entry_ids = select(DictionaryApplicationModel.entry_id).distinct()
        unused_stmt = (
            select(func.count())
            .select_from(DictionaryEntryModel)
            .where(
                DictionaryEntryModel.user_id == user_id,
                DictionaryEntryModel.project_id.is_(None),
                DictionaryEntryModel.id.not_in(used_entry_ids),
            )
        )
        unused_count = (await self._session.execute(unused_stmt)).scalar() or 0

        # Top 4 most used entries
        most_used_stmt = (
            select(
                DictionaryEntryModel.id,
                DictionaryEntryModel.name,
                DictionaryEntryModel.kind,
                func.count(DictionaryApplicationModel.id).label("used_count"),
            )
            .join(DictionaryApplicationModel, DictionaryApplicationModel.entry_id == DictionaryEntryModel.id)
            .where(
                DictionaryEntryModel.user_id == user_id,
                DictionaryEntryModel.project_id.is_(None),
            )
            .group_by(DictionaryEntryModel.id, DictionaryEntryModel.name, DictionaryEntryModel.kind)
            .order_by(func.count(DictionaryApplicationModel.id).desc())
            .limit(4)
        )
        most_used_rows = (await self._session.execute(most_used_stmt)).all()

        return DictionaryStats(
            total=total,
            by_type=by_type,
            total_applications=total_applications,
            unused_count=unused_count,
            most_used=[
                DictionaryMostUsed(id=r.id, title=r.name, type=r.kind, used_count=r.used_count)
                for r in most_used_rows
            ],
        )
