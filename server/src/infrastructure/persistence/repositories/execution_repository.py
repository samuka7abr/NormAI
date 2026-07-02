from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.reports.entities import ReportExecution
from domain.reports.repositories import ExecutionRepository
from infrastructure.persistence.models.report import ReportExecutionModel


class SqlAlchemyExecutionRepository(ExecutionRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, execution: ReportExecution) -> ReportExecution:
        model = ReportExecutionModel(
            id=execution.id,
            report_id=execution.report_id,
            status=execution.status.value,
            progress_percent=execution.progress_percent,
            current_step=execution.current_step,
            started_at=execution.started_at,
            finished_at=execution.finished_at,
            result_file_key=execution.result_file_key,
            error_log=execution.error_log,
            column_config_snapshot=execution.column_config_snapshot,
            created_at=execution.created_at,
            updated_at=execution.updated_at,
        )
        self._session.add(model)
        await self._session.flush()
        return model._to_entity()

    async def get_by_id(self, id: UUID, report_id: UUID) -> ReportExecution | None:
        stmt = select(ReportExecutionModel).where(
            ReportExecutionModel.id == id,
            ReportExecutionModel.report_id == report_id,
        )
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return model._to_entity() if model else None

    async def get_by_id_no_report_check(self, id: UUID) -> ReportExecution | None:
        stmt = select(ReportExecutionModel).where(ReportExecutionModel.id == id)
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return model._to_entity() if model else None

    async def list_by_report(self, report_id: UUID) -> list[ReportExecution]:
        stmt = (
            select(ReportExecutionModel)
            .where(ReportExecutionModel.report_id == report_id)
            .order_by(ReportExecutionModel.created_at.desc())
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [r._to_entity() for r in rows]

    async def get_latest_by_report(self, report_id: UUID) -> ReportExecution | None:
        stmt = (
            select(ReportExecutionModel)
            .where(ReportExecutionModel.report_id == report_id)
            .order_by(ReportExecutionModel.created_at.desc())
            .limit(1)
        )
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return model._to_entity() if model else None

    async def update(self, execution: ReportExecution) -> ReportExecution:
        stmt = select(ReportExecutionModel).where(ReportExecutionModel.id == execution.id)
        model = (await self._session.execute(stmt)).scalar_one()
        model.status = execution.status.value
        model.progress_percent = execution.progress_percent
        model.current_step = execution.current_step
        model.started_at = execution.started_at
        model.finished_at = execution.finished_at
        model.result_file_key = execution.result_file_key
        model.error_log = execution.error_log
        model.updated_at = execution.updated_at
        model.classification_metrics = execution.classification_metrics
        await self._session.flush()
        return model._to_entity()
