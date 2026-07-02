from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from domain.users.entities import User
from infrastructure.persistence.models import UserModel


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, user: User) -> None:
        stmt = (
            insert(UserModel)
            .values(
                id=user.id,
                email=user.email,
                password_hash=user.password_hash,
                name=user.name,
                last_name=user.last_name,
                avatar_url=user.avatar_url,
                created_at=user.created_at,
                updated_at=user.updated_at,
            )
            .on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "password_hash": user.password_hash,
                    "name": user.name,
                    "last_name": user.last_name,
                    "avatar_url": user.avatar_url,
                    "updated_at": user.updated_at,
                },
            )
        )
        await self._session.execute(stmt)

    async def find_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        model = result.scalar_one_or_none()
        return model._to_entity() if model else None

    async def find_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email.strip().lower())
        )
        model = result.scalar_one_or_none()
        return model._to_entity() if model else None

    async def exists_by_email(self, email: str) -> bool:
        result = await self._session.execute(
            select(UserModel.id).where(UserModel.email == email.strip().lower())
        )
        return result.scalar_one_or_none() is not None

    async def update_avatar(self, user_id: UUID, avatar_url: str) -> None:
        await self._session.execute(
            update(UserModel)
            .where(UserModel.id == user_id)
            .values(avatar_url=avatar_url, updated_at=datetime.now(timezone.utc))
        )
