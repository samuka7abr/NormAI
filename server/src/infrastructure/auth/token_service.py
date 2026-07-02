"""Implementação concreta de TokenService usando pyjwt e hashlib."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from application.auth.services import (
    AccessToken,
    RefreshTokenPair,
    TokenService,
)
from domain.auth.exceptions import InvalidToken, TokenExpired


class JwtTokenService(TokenService):
    """Gera access tokens JWT HS256 e refresh tokens aleatórios com hash SHA-256 para persistência."""

    def __init__(
        self,
        secret_key: str,
        algorithm: str,
        access_token_expire_minutes: int,
        refresh_token_expire_days: int,
    ) -> None:
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._access_expire_minutes = access_token_expire_minutes
        self._refresh_expire_days = refresh_token_expire_days

    def issue_access_token(self, user_id: UUID) -> AccessToken:
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=self._access_expire_minutes)

        payload = {
            "sub": str(user_id),
            "type": "access",
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
        }
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)

        return AccessToken(
            value=token,
            expires_in_seconds=self._access_expire_minutes * 60,
        )

    def decode_access_token(self, token: str) -> UUID:
        try:
            payload = jwt.decode(
                token,
                self._secret_key,
                algorithms=[self._algorithm],
            )
        except jwt.ExpiredSignatureError as e:
            raise TokenExpired("Access token expired.") from e
        except jwt.InvalidTokenError as e:
            raise InvalidToken("Invalid access token.") from e

        if payload.get("type") != "access":
            raise InvalidToken("Token is not an access token.")

        sub = payload.get("sub")
        if not sub:
            raise InvalidToken("Token has no subject.")

        try:
            return UUID(sub)
        except (ValueError, TypeError) as e:
            raise InvalidToken("Token subject is not a valid UUID.") from e

    def issue_refresh_token(self, user_id: UUID) -> RefreshTokenPair:
        plain = secrets.token_urlsafe(32)
        token_hash = self.hash_refresh_token(plain)

        return RefreshTokenPair(
            plain_value=plain,
            token_hash=token_hash,
            expires_in_seconds=self._refresh_expire_days * 24 * 60 * 60,
        )

    def hash_refresh_token(self, plain_value: str) -> str:
        return hashlib.sha256(plain_value.encode("utf-8")).hexdigest()
