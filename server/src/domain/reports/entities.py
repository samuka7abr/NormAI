from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ExecutionStatus(str, Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    ERROR = "ERROR"


@dataclass
class Report:
    id: UUID
    project_id: UUID
    original_filename: str
    original_file_key: str
    uploaded_at: datetime
    approval_status: ApprovalStatus
    approval_reason: str | None
    created_at: datetime
    updated_at: datetime


@dataclass
class ReportExecution:
    id: UUID
    report_id: UUID
    status: ExecutionStatus
    progress_percent: int
    current_step: str | None
    started_at: datetime | None
    finished_at: datetime | None
    result_file_key: str | None
    error_log: str | None
    column_config_snapshot: dict
    created_at: datetime
    updated_at: datetime
    # Métricas por coluna geradas pela classificação por IA.
    # None se a execução não terminou ou nenhuma coluna foi classificada.
    # Estrutura: {"columns": {"<col>": {"categories": [...], "unique_values": int,
    #             "classified_ok": int, "fell_to_others": int}}}
    classification_metrics: dict | None = None
