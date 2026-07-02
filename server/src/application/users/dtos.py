"""DTOs para os casos de uso de usuário."""
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class UserView:
    """Representação 'pública' de um usuário (sem hash de senha)."""
    id: UUID
    email: str
    name: str
    last_name: str
    avatar_url: str | None = None


@dataclass(frozen=True)
class UploadAvatarCommand:
    """Dados de entrada para upload de foto de perfil."""
    user_id: UUID
    file_data: bytes
    content_type: str


@dataclass(frozen=True)
class UpdateProfileCommand:
    """Dados de entrada para atualização de nome/sobrenome."""
    user_id: UUID
    name: str | None = None
    last_name: str | None = None


@dataclass(frozen=True)
class ChangePasswordCommand:
    """Dados de entrada para troca de senha."""
    user_id: UUID
    current_password: str
    new_password: str


@dataclass(frozen=True)
class ResetForgottenPasswordCommand:
    """Dados de entrada para reset de senha esquecida (sem autenticação)."""
    email: str
    new_password: str