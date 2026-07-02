"""Caso de uso: upload de foto de perfil."""
from uuid import UUID

from application.users.dtos import UploadAvatarCommand, UserView
from domain.shared.file_storage import FileStorage
from domain.users.exceptions import FileTooLarge, InvalidFileType
from domain.users.repositories import UserRepository

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# Magic bytes para validação real do conteúdo (impede renomear .exe para .jpg)
_MAGIC: list[tuple[bytes, int]] = [
    (b"\xff\xd8\xff", 0),           # JPEG
    (b"\x89PNG\r\n\x1a\n", 0),      # PNG
    (b"RIFF", 0),                   # WebP (confirmado abaixo)
]


def _is_valid_image(data: bytes) -> bool:
    if data[:3] == b"\xff\xd8\xff":
        return True
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True
    return False


class UploadAvatarUseCase:
    def __init__(self, user_repo: UserRepository, file_storage: FileStorage) -> None:
        self._user_repo = user_repo
        self._storage = file_storage

    async def execute(self, cmd: UploadAvatarCommand) -> UserView:
        if cmd.content_type not in ALLOWED_MIME_TYPES or not _is_valid_image(cmd.file_data):
            raise InvalidFileType(
                "Formato de arquivo inválido. Use JPG, JPEG, PNG ou WebP."
            )

        if len(cmd.file_data) > MAX_SIZE_BYTES:
            raise FileTooLarge(
                "Arquivo muito grande. O tamanho máximo permitido é 5 MB."
            )

        user = await self._user_repo.find_by_id(cmd.user_id)
        if user is None:
            from domain.users.exceptions import UserNotFound
            raise UserNotFound("Usuário não encontrado.")

        ext = cmd.content_type.split("/")[1]
        key = f"avatars/{cmd.user_id}.{ext}"

        await self._storage.save(key, cmd.file_data, cmd.content_type)
        avatar_url = await self._storage.generate_presigned_url(key, expires_in=365 * 24 * 3600)

        await self._user_repo.update_avatar(cmd.user_id, avatar_url)

        return UserView(
            id=user.id,
            email=user.email,
            name=user.name,
            last_name=user.last_name,
            avatar_url=avatar_url,
        )
