"""Schemas Pydantic para os endpoints de usuário."""
from pydantic import BaseModel, Field


class ChangePasswordRequest(BaseModel):
    """Corpo da requisição PATCH /users/me/password."""
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordResponse(BaseModel):
    """Resposta da troca de senha."""
    password_updated: bool


class UploadAvatarResponse(BaseModel):
    """Resposta do upload de avatar."""
    avatar_url: str


class UpdateProfileRequest(BaseModel):
    """Corpo da requisição PATCH /users/me."""
    name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)