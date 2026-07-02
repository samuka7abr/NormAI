from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ColumnConfigRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    column_name: str = Field(..., min_length=1, max_length=200)
    enabled: bool = True
    normalizations: dict = Field(default_factory=dict)
    classify: bool = False
    categories: list | None = None
    sample_values: list = Field(default_factory=list)


class UpdateColumnConfigRequest(BaseModel):
    enabled: bool | None = None
    normalizations: dict | None = None
    classify: bool | None = None
    categories: list | None = None


class ColumnConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    column_name: str
    enabled: bool
    normalizations: dict
    classify: bool
    categories: list | None
    sample_values: list
    created_at: datetime
    updated_at: datetime


class DetectedColumnResponse(BaseModel):
    column_name: str
    sample_values: list[str]
