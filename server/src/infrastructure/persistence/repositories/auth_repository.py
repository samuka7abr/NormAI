from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from domain.auth.entities import RefreshToken
from infrastructure.persistence.models import RefreshTokenModel


class SqlAlchemyRefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, refresh_token: RefreshToken) -> None:
        stmt = (
            insert(RefreshTokenModel)
            .values(
                id=refresh_token.id,
                user_id=refresh_token.user_id,
                token_hash=refresh_token.token_hash,
                expires_at=refresh_token.expires_at,
                revoked_at=refresh_token.revoked_at,
                created_at=refresh_token.created_at,
            )
            .on_conflict_do_update(
                index_elements=["id"],
                set_={"revoked_at": refresh_token.revoked_at},
            )
        )
        await self._session.execute(stmt)

    async def find_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self._session.execute(
            select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
        )
        model = result.scalar_one_or_none()
        return model._to_entity() if model else None

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        stmt = (
            update(RefreshTokenModel)
            .where(
                RefreshTokenModel.user_id == user_id,
                RefreshTokenModel.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        await self._session.execute(stmt)
