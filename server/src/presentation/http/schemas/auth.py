"""Schemas Pydantic para os endpoints de autenticação definindo formato JSON de entrada e saída."""
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Corpo da requisição POST /auth/register."""
    name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Corpo da requisição POST /auth/login."""
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    """Resposta com dados públicos do usuário (sem password_hash); usada por register, login e /users/me."""
    id: str
    email: EmailStr
    name: str
    last_name: str
    avatar_url: str | None = None


class AuthenticatedResponse(BaseModel):
    """Resposta de /auth/refresh."""
    authenticated: bool


class LogoutResponse(BaseModel):
    """Resposta de /auth/logout."""
    authenticated: bool


class ResetForgottenPasswordRequest(BaseModel):
    """Corpo da requisição POST /auth/reset-password."""
    email: EmailStr
    new_password: str = Field(min_length=8, max_length=128)
