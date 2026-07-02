from domain.projects.exceptions import ProjectNotFound
from domain.projects.repositories import ProjectRepository
from domain.reports.repositories import ExecutionRepository, ReportRepository

from application.reports.dtos import ListReportsInput, PaginatedReportsOutput, ReportWithLatestExecutionOutput


class ListReportsUseCase:
    def __init__(
        self,
        project_repo: ProjectRepository,
        report_repo: ReportRepository,
        execution_repo: ExecutionRepository,
    ) -> None:
        self._project_repo = project_repo
        self._report_repo = report_repo
        self._execution_repo = execution_repo

    async def execute(self, inp: ListReportsInput) -> PaginatedReportsOutput:
        page_size = min(inp.page_size, 100)
        offset = (inp.page - 1) * page_size

        project = await self._project_repo.get_by_id(inp.project_id, inp.user_id)
        if project is None:
            raise ProjectNotFound(f"Project {inp.project_id} not found.")

        reports, total = await self._report_repo.list_by_project(inp.project_id, offset, page_size)

        items = []
        for r in reports:
            latest = await self._execution_repo.get_latest_by_report(r.id)
            items.append(
                ReportWithLatestExecutionOutput(
                    id=r.id,
                    project_id=r.project_id,
                    original_filename=r.original_filename,
                    uploaded_at=r.uploaded_at,
                    approval_status=r.approval_status,
                    latest_execution_status=latest.status if latest else None,
                    latest_execution_id=latest.id if latest else None,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
            )

        return PaginatedReportsOutput.build(items, total, inp.page, page_size)
