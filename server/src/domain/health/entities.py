from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class HealthStatus:
    app_name: str
    environment: str
    version: str
    status: str

