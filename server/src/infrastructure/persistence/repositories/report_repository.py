from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.reports.entities import Report
from domain.reports.repositories import ReportRepository
from infrastructure.persistence.models.report import ReportModel


class SqlAlchemyReportRepository(ReportRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, report: Report) -> Report:
        model = ReportModel(
            id=report.id,
            project_id=report.project_id,
            original_filename=report.original_filename,
            original_file_key=report.original_file_key,
            uploaded_at=report.uploaded_at,
            approval_status=report.approval_status.value,
            approval_reason=report.approval_reason,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )
        self._session.add(model)
        await self._session.flush()
        return model._to_entity()

    async def get_by_id(self, id: UUID, project_id: UUID) -> Report | None:
        stmt = select(ReportModel).where(
            ReportModel.id == id,
            ReportModel.project_id == project_id,
        )
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return model._to_entity() if model else None

    async def get_by_id_internal(self, id: UUID) -> Report | None:
        stmt = select(ReportModel).where(ReportModel.id == id)
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return model._to_entity() if model else None

    async def list_by_project(
        self, project_id: UUID, offset: int, limit: int
    ) -> tuple[list[Report], int]:
        total_col = func.count().over().label("total")
        stmt = (
            select(ReportModel, total_col)
            .where(ReportModel.project_id == project_id)
            .order_by(ReportModel.uploaded_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).all()
        if not rows:
            return [], 0
        reports = [row[0]._to_entity() for row in rows]
        total = rows[0][1]
        return reports, total

    async def update(self, report: Report) -> Report:
        stmt = select(ReportModel).where(ReportModel.id == report.id)
        model = (await self._session.execute(stmt)).scalar_one()
        model.approval_status = report.approval_status.value
        model.approval_reason = report.approval_reason
        model.updated_at = report.updated_at
        await self._session.flush()
        return model._to_entity()
