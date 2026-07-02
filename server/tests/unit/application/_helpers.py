"""Fakes compartilhados pelos testes unitários da camada de application."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from application.auth.services import AccessToken, RefreshTokenPair
from domain.activity.entities import Activity, ActivityType
from domain.activity.repositories import ActivityRepository
from domain.auth.entities import RefreshToken
from domain.auth.exceptions import InvalidToken, TokenExpired
from domain.users.entities import User


class FakePasswordHasher:
    """Hasher 'reversível' só pra testes — prefixa 'HASH:' à senha."""

    def hash(self, password: str) -> str:
        return f"HASH:{password}"

    def verify(self, password: str, hashed: str) -> bool:
        return hashed == f"HASH:{password}"


class FakeTokenService:
    """TokenService em memória, determinístico, pra testes."""

    def __init__(
        self,
        access_expire_minutes: int = 15,
        refresh_expire_days: int = 7,
    ) -> None:
        self._access_expire_minutes = access_expire_minutes
        self._refresh_expire_days = refresh_expire_days
        self._access_to_user: dict[str, UUID | str] = {}

    def issue_access_token(self, user_id: UUID) -> AccessToken:
        token = f"access-{secrets.token_hex(8)}"
        self._access_to_user[token] = user_id
        return AccessToken(
            value=token,
            expires_in_seconds=self._access_expire_minutes * 60,
        )

    def decode_access_token(self, token: str) -> UUID:
        if token not in self._access_to_user:
            raise InvalidToken("unknown token")
        value = self._access_to_user[token]
        if value == "EXPIRED":
            raise TokenExpired("expired")
        return value  # type: ignore[return-value]

    def expire(self, token: str) -> None:
        self._access_to_user[token] = "EXPIRED"

    def issue_refresh_token(self, user_id: UUID) -> RefreshTokenPair:
        plain = f"refresh-{secrets.token_hex(8)}"
        token_hash = self.hash_refresh_token(plain)
        return RefreshTokenPair(
            plain_value=plain,
            token_hash=token_hash,
            expires_in_seconds=self._refresh_expire_days * 24 * 60 * 60,
        )

    def hash_refresh_token(self, plain_value: str) -> str:
        return hashlib.sha256(plain_value.encode()).hexdigest()


class FakeUserRepository:
    """UserRepository em memória."""

    def __init__(self) -> None:
        self._by_id: dict[UUID, User] = {}

    async def save(self, user: User) -> None:
        self._by_id[user.id] = user

    async def find_by_id(self, user_id: UUID) -> User | None:
        return self._by_id.get(user_id)

    async def find_by_email(self, email: str) -> User | None:
        normalized = email.strip().lower()
        for user in self._by_id.values():
            if user.email == normalized:
                return user
        return None

    async def exists_by_email(self, email: str) -> bool:
        return await self.find_by_email(email) is not None


class FakeRefreshTokenRepository:
    """RefreshTokenRepository em memória."""

    def __init__(self) -> None:
        self._by_hash: dict[str, RefreshToken] = {}

    async def save(self, refresh_token: RefreshToken) -> None:
        self._by_hash[refresh_token.token_hash] = refresh_token

    async def find_by_hash(self, token_hash: str) -> RefreshToken | None:
        return self._by_hash.get(token_hash)

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        now = datetime.now(timezone.utc)
        for token in self._by_hash.values():
            if token.user_id == user_id and not token.is_revoked():
                token.revoked_at = now

    def all_active_for(self, user_id: UUID) -> list[RefreshToken]:
        return [
            t for t in self._by_hash.values()
            if t.user_id == user_id and not t.is_revoked()
        ]


class InMemoryActivityRepository(ActivityRepository):
    """ActivityRepository em memória para testes."""

    def __init__(self) -> None:
        self._store: list[Activity] = []

    async def create(
        self,
        user_id: UUID,
        project_id: UUID,
        type: ActivityType,
        project_name: str,
    ) -> Activity:
        activity = Activity(
            id=uuid4(),
            user_id=user_id,
            project_id=project_id,
            type=type.value,
            project_name=project_name,
            created_at=datetime.now(timezone.utc),
        )
        self._store.append(activity)
        return activity

    async def list_by_user(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Activity], int]:
        user_activities = [a for a in self._store if a.user_id == user_id]
        user_activities.sort(key=lambda a: a.created_at, reverse=True)
        total = len(user_activities)
        return user_activities[offset : offset + limit], total


def make_expired_refresh(user_id: UUID, token_hash: str) -> RefreshToken:
    return RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )
