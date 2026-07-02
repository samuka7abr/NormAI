"""DTOs para os casos de uso de autenticação."""
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class RegisterUserCommand:
    """Dados de entrada para registrar um novo usuário."""
    email: str
    password: str
    name: str
    last_name: str


@dataclass(frozen=True)
class LoginUserCommand:
    """Dados de entrada para login."""
    email: str
    password: str


@dataclass(frozen=True)
class RefreshSessionCommand:
    """Dados de entrada para renovar sessão. O refresh token vem do cookie."""
    refresh_token: str


@dataclass(frozen=True)
class LogoutUserCommand:
    """Dados de entrada para logout. Refresh token vem do cookie (pode ser None)."""
    refresh_token: str | None


@dataclass(frozen=True)
class AuthenticatedSession:
    """Resultado de operações que criam ou renovam sessão, contendo usuário e tokens gerados."""
    user_id: UUID
    user_email: str
    user_name: str
    user_last_name: str
    access_token: str
    access_token_expires_in: int
    refresh_token: str
    refresh_token_expires_in: int
