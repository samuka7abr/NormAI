from fastapi import APIRouter, Depends
from pydantic import BaseModel

from application.health.check_health import CheckHealthUseCase
from domain.health.entities import HealthStatus
from infrastructure.settings import Settings, get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    app_name: str
    environment: str
    version: str
    status: str

    @classmethod
    def from_domain(cls, health_status: HealthStatus) -> "HealthResponse":
        return cls(
            app_name=health_status.app_name,
            environment=health_status.environment,
            version=health_status.version,
            status=health_status.status,
        )


def get_check_health_use_case(
    settings: Settings = Depends(get_settings),
) -> CheckHealthUseCase:
    return CheckHealthUseCase(settings=settings)


@router.get("/health", response_model=HealthResponse)
def health_check(
    use_case: CheckHealthUseCase = Depends(get_check_health_use_case),
) -> HealthResponse:
    return HealthResponse.from_domain(use_case.execute())
