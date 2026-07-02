from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.configure_columns import ConfigureColumnsUseCase
from application.projects.create_project import CreateProjectUseCase
from application.projects.delete_project import DeleteProjectUseCase
from application.projects.detect_columns import DetectColumnsUseCase
from application.projects.get_project import GetProjectUseCase
from application.projects.list_projects import ListProjectsUseCase
from application.projects.update_column_config import UpdateColumnConfigUseCase
from application.projects.update_project import UpdateProjectUseCase
from infrastructure.persistence.database import get_db
from infrastructure.persistence.repositories.activity_repository import SqlAlchemyActivityRepository
from infrastructure.persistence.repositories.column_config_repository import SqlAlchemyColumnConfigRepository
from infrastructure.persistence.repositories.project_repository import SqlAlchemyProjectRepository
from infrastructure.spreadsheet.column_detector import SpreadsheetColumnDetector

_detector = SpreadsheetColumnDetector()


def get_create_project_use_case(db: AsyncSession = Depends(get_db)) -> CreateProjectUseCase:
    return CreateProjectUseCase(SqlAlchemyProjectRepository(db), SqlAlchemyActivityRepository(db))


def get_get_project_use_case(db: AsyncSession = Depends(get_db)) -> GetProjectUseCase:
    return GetProjectUseCase(SqlAlchemyProjectRepository(db))


def get_list_projects_use_case(db: AsyncSession = Depends(get_db)) -> ListProjectsUseCase:
    return ListProjectsUseCase(SqlAlchemyProjectRepository(db))


def get_update_project_use_case(db: AsyncSession = Depends(get_db)) -> UpdateProjectUseCase:
    return UpdateProjectUseCase(SqlAlchemyProjectRepository(db))


def get_delete_project_use_case(db: AsyncSession = Depends(get_db)) -> DeleteProjectUseCase:
    return DeleteProjectUseCase(SqlAlchemyProjectRepository(db))


def get_configure_columns_use_case(db: AsyncSession = Depends(get_db)) -> ConfigureColumnsUseCase:
    return ConfigureColumnsUseCase(SqlAlchemyProjectRepository(db), SqlAlchemyColumnConfigRepository(db))


def get_update_column_config_use_case(db: AsyncSession = Depends(get_db)) -> UpdateColumnConfigUseCase:
    return UpdateColumnConfigUseCase(SqlAlchemyColumnConfigRepository(db))


def get_detect_columns_use_case() -> DetectColumnsUseCase:
    return DetectColumnsUseCase(_detector)
