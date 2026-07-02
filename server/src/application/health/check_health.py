from domain.health.entities import HealthStatus
from infrastructure.settings import Settings


class CheckHealthUseCase:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def execute(self) -> HealthStatus:
        return HealthStatus(
            app_name=self._settings.app_name,
            environment=self._settings.app_env,
            version=self._settings.app_version,
            status="ok",
        )
